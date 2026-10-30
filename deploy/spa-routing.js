// CloudFront Function (viewer request) on the S3 behavior: any path without a file extension is
// an app route, so serve the SPA shell and let the router take over in the browser.
// Kept off /api/* so real API 404s stay 404s.
function handler(event) {
  var request = event.request;
  if (request.uri.indexOf(".") === -1) {
    request.uri = "/_shell.html";
  }
  return request;
}
