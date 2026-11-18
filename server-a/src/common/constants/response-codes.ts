/**
 * Standardized API Response Codes
 * Follows Bunny Cove / DaSSO Clean Architecture specification.
 */
export const ResponseCodes = {
  // General
  SUCCESS: "success",
  SERVER_ERROR: "server_error",
  VALIDATION_ERROR: "validation_error",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",

  // Authentication & Registration
  REGISTER_SUCCESSFUL: "register_successful",
  LOGIN_SUCCESSFUL: "login_successful",
  LOGOUT_SUCCESSFUL: "logout_successful",
  TOKEN_REFRESHED: "token_refreshed",
  INVALID_CREDENTIALS: "invalid_credentials",
  EMAIL_ALREADY_EXISTS: "email_already_exists",
  USERNAME_ALREADY_EXISTS: "username_already_exists",
  USER_ALREADY_EXISTS: "user_already_exists",
  USER_NOT_FOUND: "user_not_found",
  INVALID_TOKEN: "invalid_token",
  TOKEN_EXPIRED: "token_expired",
  ACCESS_DENIED: "access_denied",

  // Email Verification
  VERIFICATION_EMAIL_SENT: "verification_email_sent",
  EMAIL_VERIFIED_SUCCESSFUL: "email_verified_successful",
  EMAIL_ALREADY_VERIFIED: "email_already_verified",
  EMAIL_NOT_VERIFIED: "email_not_verified",
  INVALID_OTP: "invalid_otp",
  OTP_EXPIRED: "otp_expired",

  // User Management
  PROFILE_FETCHED: "profile_fetched",
  PROFILE_UPDATED: "profile_updated",
  USERS_FETCHED: "users_fetched",
  USER_CREATED: "user_created",
  USER_DELETED: "user_deleted",
} as const;

export type ResponseCode = (typeof ResponseCodes)[keyof typeof ResponseCodes];
