"""Alias module: SignFlo naming for the Zoho-compatible auth implementation."""

from api.zoho.auth import ZohoAPIError, zoho_api_error_handler, router

__all__ = ["ZohoAPIError", "zoho_api_error_handler", "router"]

