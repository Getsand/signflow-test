class UserAlreadyExistsError(Exception):
    def __init__(self, message: str = "A user with this email already exists."):
        super().__init__(message)


class InvalidCredentialsError(Exception):
    def __init__(self, message: str = "The credentials provided are invalid."):
        super().__init__(message)


class UserInactiveError(Exception):
    def __init__(self, message: str = "This user account is inactive."):
        super().__init__(message)
