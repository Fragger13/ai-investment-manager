from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    # Enforced at the API too (not just the form): a leaked curl one-liner
    # should not be able to create an account with a 1-character password.
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    name: str
    email: EmailStr
    onboarding_complete: bool = False
    email_verified: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class VerificationStatusResponse(BaseModel):
    email: EmailStr
    email_verified: bool
    sent: bool = False
    provider: str | None = None
    detail: str | None = None
