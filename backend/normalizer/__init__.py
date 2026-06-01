"""
Product Name Normalization Pipeline for Pharmacy POS Data.

Transforms inconsistent Arabic/English product names into a clean,
standardized format to enable reliable matching.

Usage:
    from normalizer import normalize
    result = normalize("*CIPRALEX 10MG 28T")
    # => "cipralex 10 mg 28 tab"
"""

from normalizer.core.pipeline import normalize, create_pipeline

__all__ = ["normalize", "create_pipeline"]
