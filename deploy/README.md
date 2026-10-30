# Deploying the frontend to S3 + CloudFront (us-east-2)

The site is a static SPA (TanStack Start in SPA mode, output in `.output/public`). One CloudFront
distribution serves it over HTTPS on its `*.cloudfront.net` address and also routes `/api/*` to the
backend's **internal** ALB through a CloudFront VPC origin. So:

- no domain or certificate is needed for HTTPS,
- the browser only ever talks to one origin (no CORS),
- the ALB is not reachable from the internet.

```
browser ──HTTPS──> CloudFront ──/*──────> S3 bucket (private, Origin Access Control)
                              └─/api/*──> VPC origin ──> internal ALB :80 ──> struct-api :3000
```

| File | Purpose |
|---|---|
| `spa-routing.js` | CloudFront Function: paths without a file extension get `/_shell.html` |
| `distribution-config.json` | The distribution (origins, behaviors, managed cache policies) |
| `bucket-policy.json` | Lets only this distribution read the bucket |
| `../.github/workflows/deploy.yml` | Build, upload to S3 and invalidate on every push to `main` |

Run everything from `frontend/deploy/` in PowerShell, as an IAM user with the backend's
`deployer-policy.json` (inline) and `deployer-frontend-policy.json` (customer managed: together they
exceed the 2048-character inline limit) attached.

Already created (2026-10-30): bucket `struct-frontend-094289742685`, internal ALB
`struct-alb-internal` (SG `sg-01a5ed5ce4e0e9a17`), target group `struct-api-internal`, VPC origin `vo_CHfZJFTPx3kBWw0WF0uT0p`,
OAC `E161D840R4UYXW`, function `struct-spa-routing`, distribution `E1GJMLZYXXMPZG` (`https://d1ffqnowqt49bs.cloudfront.net`).

## 1. Bucket

New buckets block all public access by default; CloudFront reads it through Origin Access Control.

```powershell
$bucket = "struct-frontend-094289742685"
aws s3api create-bucket --bucket $bucket --region us-east-2 --create-bucket-configuration LocationConstraint=us-east-2
```

## 2. Internal ALB for the API

```powershell
$vpc = "vpc-0cfac54ac54b206c0"
$subnets = "subnet-0f13d0bc13ba303be", "subnet-0bfdf3d44bd5e5cf3", "subnet-0771ab1e55bc52f91"
$apiSg = "sg-0b1570fac13478b7a"

$ialbSg = aws ec2 create-security-group --group-name struct-alb-internal --description "Struct internal ALB (CloudFront VPC origin)" --vpc-id $vpc --region us-east-2 --query GroupId --output text
aws ec2 authorize-security-group-ingress --group-id $apiSg --protocol tcp --port 3000 --source-group $ialbSg --region us-east-2

$ialbArn = aws elbv2 create-load-balancer --name struct-alb-internal --scheme internal --subnets $subnets --security-groups $ialbSg --region us-east-2 --query "LoadBalancers[0].LoadBalancerArn" --output text
$ialbDns = aws elbv2 describe-load-balancers --load-balancer-arns $ialbArn --region us-east-2 --query "LoadBalancers[0].DNSName" --output text

$tgArn = aws elbv2 create-target-group --name struct-api-internal --protocol HTTP --port 3000 --vpc-id $vpc --target-type ip --health-check-path /api --region us-east-2 --query "TargetGroups[0].TargetGroupArn" --output text
aws elbv2 create-listener --load-balancer-arn $ialbArn --protocol HTTP --port 80 --default-actions "Type=forward,TargetGroupArn=$tgArn" --region us-east-2
```

## 3. Point the API service at the new target group

```powershell
aws ecs update-service --cluster struct-cluster --service struct-api --load-balancers "targetGroupArn=$tgArn,containerName=api,containerPort=3000" --region us-east-2
aws ecs wait services-stable --cluster struct-cluster --services struct-api --region us-east-2
```

## 4. VPC origin

Takes ~10 minutes to deploy. CloudFront creates a `CloudFront-VPCOrigins-Service-SG` security group
in the VPC; the ALB must accept traffic from it.

```powershell
$vpcOriginId = aws cloudfront create-vpc-origin --vpc-origin-endpoint-config "Name=struct-alb-internal,Arn=$ialbArn,HTTPPort=80,HTTPSPort=443,OriginProtocolPolicy=http-only" --query "VpcOrigin.Id" --output text

# Repeat until it prints "Deployed"
aws cloudfront get-vpc-origin --id $vpcOriginId --query "VpcOrigin.Status" --output text

$cfSg = aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc" "Name=group-name,Values=CloudFront-VPCOrigins-Service-SG" --region us-east-2 --query "SecurityGroups[0].GroupId" --output text
aws ec2 authorize-security-group-ingress --group-id $ialbSg --protocol tcp --port 80 --source-group $cfSg --region us-east-2
```

## 5. Origin Access Control and SPA routing function

```powershell
$oacId = aws cloudfront create-origin-access-control --origin-access-control-config "Name=struct-frontend,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" --query "OriginAccessControl.Id" --output text

$fnEtag = aws cloudfront create-function --name struct-spa-routing --function-config "Comment=Serve the SPA shell for app routes,Runtime=cloudfront-js-2.0" --function-code fileb://spa-routing.js --query ETag --output text
aws cloudfront publish-function --name struct-spa-routing --if-match $fnEtag
$fnArn = aws cloudfront describe-function --name struct-spa-routing --stage LIVE --query "FunctionSummary.FunctionMetadata.FunctionARN" --output text
```

## 6. Distribution and bucket policy

```powershell
(Get-Content distribution-config.json -Raw) `
  -replace "REPLACE_WITH_OAC_ID", $oacId `
  -replace "REPLACE_WITH_INTERNAL_ALB_DNS", $ialbDns `
  -replace "REPLACE_WITH_VPC_ORIGIN_ID", $vpcOriginId `
  -replace "REPLACE_WITH_FUNCTION_ARN", $fnArn |
  Set-Content -Encoding ascii $env:TEMP\struct-distribution.json

$dist = aws cloudfront create-distribution --distribution-config file://$env:TEMP\struct-distribution.json --query "Distribution.[Id,ARN,DomainName]" --output text
$distId, $distArn, $distDomain = $dist -split "\s+"

(Get-Content bucket-policy.json -Raw) -replace "REPLACE_WITH_DISTRIBUTION_ARN", $distArn |
  Set-Content -Encoding ascii $env:TEMP\struct-bucket-policy.json
aws s3api put-bucket-policy --bucket $bucket --policy file://$env:TEMP\struct-bucket-policy.json

"Distribution: $distId  https://$distDomain"
```

Put `$distId` into `DISTRIBUTION_ID` in `.github/workflows/deploy.yml`.

## 7. Let GitHub Actions deploy

The workflow reuses the backend's `struct-github-deploy` role. Its trust policy and permissions live
in `backend/deploy/` (`github-trust-policy.json`, `github-deploy-policy.json`); after adding this
repo and the bucket/distribution to them:

```powershell
cd ..\..\backend\deploy
aws iam update-assume-role-policy --role-name struct-github-deploy --policy-document file://github-trust-policy.json
aws iam put-role-policy --role-name struct-github-deploy --policy-name struct-github-deploy --policy-document file://github-deploy-policy.json
```

## 8. First deploy and check

Either push to `main`, or by hand from `frontend/`:

```powershell
$env:VITE_API_URL = "/api"; npm run build; Remove-Item Env:VITE_API_URL
aws s3 sync .output/public/assets "s3://$bucket/assets" --cache-control "public,max-age=31536000,immutable"
aws s3 sync .output/public "s3://$bucket" --exclude "assets/*" --cache-control "no-cache" --delete
aws cloudfront create-invalidation --distribution-id $distId --paths "/*"
```

The distribution takes a few minutes to deploy. Then:

```powershell
curl.exe -I "https://$distDomain/projects"   # 200, the SPA shell
curl.exe "https://$distDomain/api"            # Hello World! from the API
```

## Notes

- **Local dev:** `src/lib/api.ts` defaults to `http://localhost:3000/api`. A `.env.local` that sets
  `VITE_API_URL` must include the `/api` suffix.
- **Old assets** under `assets/` are never deleted, so open tabs keep working across deploys. They
  are a few hundred KB per deploy; clear them out occasionally if you like.
- **Custom domain later:** request an ACM certificate in **us-east-1** for the domain, add it and the
  alias to the distribution, and point DNS at `$distDomain`. Nothing else changes.
- **Cost:** CloudFront and S3 are pennies at this traffic; VPC origins are free. The internal ALB
  replaces the public one (~$16/month either way).
