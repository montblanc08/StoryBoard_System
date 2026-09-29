class DomainError(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)

class NotFoundError(DomainError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message=message, code="NOT_FOUND")

class ConflictError(DomainError):
    def __init__(self, message: str = "Resource conflict", details: dict = None):
        super().__init__(message=message, code="CONFLICT")
        self.details = details or {}
