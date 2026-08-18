# Specification — Custom Matcher Sheet Export Schema

This specification outlines the mappings and schema format for the matcher export functionality. When exporting the matched sheet, the columns should align with the required output fields by mapping existing product data, joining related category/brand attributes, and extracting the dosage unit.

## 1. Export Columns & Data Source Mappings

| Target Column | Source Field / Retrieval Logic | Default / Fallback |
| :--- | :--- | :--- |
| **name[en]** | Matched product `title_en` | `""` |
| **name[eg]** | Matched product `title_ar` | `""` |
| **details[en]** | Matched product `description_en` (or `meta_description_en`) | `""` |
| **details[eg]** | Matched product `description_ar` (or `meta_description_ar`) | `""` |
| **category_id** | Matched product `level_one_category.slug` | `""` |
| **sub_category_id** | Matched product `level_two_category[0].slug` | `""` |
| **sub_sub_category_id** | Matched product `level_three_category[0].slug` | `""` |
| **brand_id** | Matched product `brands.id` | `""` |
| **unit** | Pre-populated in the product records using a regex-based parsing script over the 29k dataset | `""` |
| **thumbnail** | Matched product `image` url | `""` |
| **images** | Comma-separated list containing `image` url | `""` |

### Related Brand Fields (`...brands fields`)
These fields are retrieved from the matched product's `brands` dictionary attribute:
*   **brand_name_en**: `brands.title_en`
*   **brand_name_ar**: `brands.title_ar`
*   **brand_slug**: `brands.slug`
*   **brand_logo_url**: `brands.images` (or `logo_url`)

### Related Category Fields (`...categories fields`)
These fields are retrieved from the matched product's nested category level structures:
*   **category_name_en**: `level_one_category.title_en`
*   **category_name_ar**: `level_one_category.title_ar`
*   **category_slug**: `level_one_category.slug`
*   **sub_category_name_en**: `level_two_category[0].title_en`
*   **sub_category_name_ar**: `level_two_category[0].title_ar`
*   **sub_category_slug**: `level_two_category[0].slug`
*   **sub_sub_category_name_en**: `level_three_category[0].title_en`
*   **sub_sub_category_name_ar**: `level_three_category[0].title_ar`
*   **sub_sub_category_slug**: `level_three_category[0].slug`

---

## 2. Unit Extraction Script Specifications

A Python script will be run once over the 29,000 product entries in `chefaa_products_eg_normalized.json` to extract and inject a `unit` field directly into each product record.

### Target Units and Regex Rules
The regex patterns will ignore capitalization and will match units even if they are attached to digits (e.g. `14Tab` or `2Syringe`):

*   **Tablet**: `(?:\b|\d)(?:tablet[s]?|tab[s]?)\b` or `\b(?:قرص|أقراص)\b`
*   **Capsule**: `(?:\b|\d)(?:capsule[s]?|cap[s]?)\b` or `\b(?:كبسولة|كبسولات)\b`
*   **Ampoule**: `(?:\b|\d)(?:ampoule[s]?|amp[s]?)\b` or `\b(?:أمبول|أمبولات|امبول|امبولات)\b`
*   **Vial**: `(?:\b|\d)(?:vial[s]?)\b` or `\b(?:فيل)\b`
*   **Sachet**: `(?:\b|\d)(?:sachet[s]?|sac[s]?)\b` or `\b(?:كيس|أكياس)\b`
*   **Suppository**: `(?:\b|\d)(?:suppositor(?:y|ies)|supp[s]?)\b` or `\b(?:لبوس|قمع|أقماع)\b`
*   **Drops**: `(?:\b|\d)(?:drop[s]?)\b` or `\b(?:نقط|قطرة|قطرات)\b`
*   **Pen**: `(?:\b|\d)(?:pen[s]?|kwikpen[s]?)\b` or `\b(?:قلم|أقلام)\b`
*   **Syringe**: `(?:\b|\d)(?:syringe[s]?)\b` or `\b(?:سرنجة|سرنجات)\b`
*   **Cartridge**: `(?:\b|\d)(?:cartridge[s]?)\b` or `\b(?:خرطوشة)\b`
*   **Penfill**: `(?:\b|\d)(?:penfill[s]?)\b`

If a product does not match any of these unit patterns (e.g., cosmetics, medical devices, standard creams/shampoos), the `unit` field will be stored as an empty string `""`.

---

## 3. Technical Implementation Rules

1.  **Empty Row Handling**: For rows in the matcher process that did not find any match (`no_match`), the export fields listed above should all be populated as empty (`""` or `None`), maintaining the structure of the sheet.
2.  **Export Format**: The custom columns should be appended to the exported Excel (`.xlsx`) sheet output after the original matched sheet fields.
3.  **JSON List Serialization**: The `images` column is formatted as a comma-separated string containing the product image URL.
