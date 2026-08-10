"""Shared exceptions for catalog pipeline."""


class PipelineCancelled(Exception):
    """Raised when a pipeline job is cancelled by the user."""
