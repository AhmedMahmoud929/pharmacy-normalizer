export interface ColumnOption {
  key: string;
  label: string;
  defaultChecked?: boolean;
}

export const columnOptions: ColumnOption[] = [
  { key: "id", label: "Product ID", defaultChecked: true },
  { key: "name_en", label: "English Name", defaultChecked: true },
  { key: "name_ar", label: "Arabic Name", defaultChecked: true },
  { key: "sku", label: "Reference SKU", defaultChecked: true },
  { key: "brand", label: "Brand / Manufacturer", defaultChecked: true },
  { key: "brand_index_code", label: "Brand Index Code", defaultChecked: true },
  { key: "category", label: "Classification Category", defaultChecked: true },
  { key: "category_index_code", label: "Category Index Code", defaultChecked: true },
  { key: "sub_category_index_code", label: "Sub Category Index Code", defaultChecked: true },
  { key: "sub_sub_category_index_code", label: "Sub Sub Category Index Code", defaultChecked: true },
  { key: "price", label: "Catalog Price", defaultChecked: true },
  { key: "in_stock", label: "In Stock Flag", defaultChecked: true },
  { key: "stock", label: "Quantity Stock", defaultChecked: true },
  { key: "share_link", label: "Storefront Web Link", defaultChecked: true },
  { key: "image", label: "Asset Thumbnail URL", defaultChecked: false },
  { key: "image_name", label: "Image Name", defaultChecked: true }
];

export const brandColumnOptions: ColumnOption[] = [
  { key: "index_code", label: "Index Code", defaultChecked: true },
  { key: "id", label: "Brand ID", defaultChecked: true },
  { key: "name_en", label: "English Name", defaultChecked: true },
  { key: "name_ar", label: "Arabic Name", defaultChecked: true },
  { key: "slug", label: "Brand Slug", defaultChecked: true },
  { key: "image", label: "Logo Asset URL", defaultChecked: false },
  { key: "count", label: "Product Count", defaultChecked: false },
  { key: "is_local_image", label: "Local Image Flag", defaultChecked: false },
  { key: "image_name", label: "Image Name", defaultChecked: true }
];

export const categoryColumnOptions: ColumnOption[] = [
  { key: "index_code", label: "Index Code", defaultChecked: true },
  { key: "id", label: "Category ID", defaultChecked: true },
  { key: "name_en", label: "English Name", defaultChecked: true },
  { key: "name_ar", label: "Arabic Name", defaultChecked: true },
  { key: "slug", label: "Category Slug", defaultChecked: true },
  { key: "level", label: "Taxonomy Level", defaultChecked: true },
  { key: "parent_slug", label: "Parent Category Slug", defaultChecked: true },
  { key: "count", label: "Product Count", defaultChecked: true }
];

export interface MatcherColumnOption {
  key: string;
  label: string;
  group: "matcher" | "product";
  defaultChecked?: boolean;
}

export const matcherColumnOptions: MatcherColumnOption[] = [
  // Matcher Fields
  { key: "row_index", label: "Row Number", group: "matcher", defaultChecked: false },
  { key: "original_name", label: "Original Product Name", group: "matcher", defaultChecked: false },
  { key: "normalized_name", label: "Normalized Query", group: "matcher", defaultChecked: false },
  { key: "match_status", label: "Match Status", group: "matcher", defaultChecked: true },
  { key: "match_score", label: "Confidence Score", group: "matcher", defaultChecked: true },
  { key: "jaccard", label: "Jaccard Token Overlap", group: "matcher", defaultChecked: false },
  { key: "sequence", label: "Sequence Similarity", group: "matcher", defaultChecked: false },
  { key: "matched_tokens", label: "Aligned Tokens", group: "matcher", defaultChecked: false },

  // Product Fields
  { key: "id", label: "Product ID", group: "product", defaultChecked: true },
  { key: "name_en", label: "English Name", group: "product", defaultChecked: true },
  { key: "name_ar", label: "Arabic Name", group: "product", defaultChecked: true },
  { key: "sku", label: "Reference SKU", group: "product", defaultChecked: true },
  { key: "brand", label: "Brand / Manufacturer", group: "product", defaultChecked: true },
  { key: "category", label: "Classification Category", group: "product", defaultChecked: true },
  { key: "price", label: "Catalog Price", group: "product", defaultChecked: true },
  { key: "in_stock", label: "In Stock Flag", group: "product", defaultChecked: true },
  { key: "stock", label: "Quantity Stock", group: "product", defaultChecked: true },
  { key: "share_link", label: "Storefront Web Link", group: "product", defaultChecked: true },
  { key: "image", label: "Asset Thumbnail URL", group: "product", defaultChecked: false },
  { key: "image_name", label: "Image Name", group: "product", defaultChecked: true }
];

