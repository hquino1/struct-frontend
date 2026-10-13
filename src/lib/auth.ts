import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { defaultStorage, sessionStorage } from "aws-amplify/utils";

// Public Cognito app client (no secret), so these IDs are safe to ship to the browser.
// The app client must have ALLOW_USER_SRP_AUTH and ALLOW_REFRESH_TOKEN_AUTH enabled.
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-2_o5P6JAFRX",
      userPoolClientId: "1sl1hc6admp0vbt0med838sdke",
      loginWith: { email: true },
      signUpVerificationMethod: "code",
    },
  },
});

// "Keep me signed in" keeps tokens in localStorage; otherwise they live in sessionStorage
// and are cleared when the tab closes. The choice is remembered so reloads read the same store.
const REMEMBER_KEY = "struct-remember-me";

export function isRemembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setRememberMe(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, String(remember));
  } catch {}
  cognitoUserPoolsTokenProvider.setKeyValueStorage(remember ? defaultStorage : sessionStorage);
}

if (typeof window !== "undefined" && !isRemembered()) {
  cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage);
}

const friendlyMessages: Record<string, string> = {
  NotAuthorizedException: "Incorrect email or password.",
  UserNotFoundException: "Incorrect email or password.",
  UsernameExistsException: "An account with this email already exists. Try signing in.",
  CodeMismatchException: "That code isn't right. Check your email and try again.",
  ExpiredCodeException: "That code has expired. Request a new one.",
  LimitExceededException: "Too many attempts. Please wait a few minutes and try again.",
  TooManyRequestsException: "Too many attempts. Please wait a few minutes and try again.",
};

export function authErrorMessage(err: unknown) {
  if (err instanceof Error) return friendlyMessages[err.name] ?? err.message;
  return "Something went wrong. Please try again.";
}
