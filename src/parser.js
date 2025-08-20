// src/parser.js

/**
 * Excelから読み込んだフラットなデータ配列を、階層構造を持つJSONに変換します。
 * @param {Array<Object>} data - 各行がオブジェクトになったデータの配列。
 * @returns {Array<Object>} 階層化されたJSONデータ。
 */
export const parseExcelDataToJson = (data) => {
  const result = [];
  const categoryMap = new Map();
  let itemId = 1;

  data.forEach(row => {
    const categoryName = row['大項目'];
    const subcategoryName = row['中項目'];

    let category = categoryMap.get(categoryName);
    if (!category) {
      category = {
        category: categoryName,
        subcategories: [],
        _subcategoryMap: new Map()
      };
      result.push(category);
      categoryMap.set(categoryName, category);
    }

    let subcategory = category._subcategoryMap.get(subcategoryName);
    if (!subcategory) {
      subcategory = {
        name: subcategoryName,
        items: []
      };
      category.subcategories.push(subcategory);
      category._subcategoryMap.set(subcategoryName, subcategory);
    }

    subcategory.items.push({
      id: `check-item-${itemId++}`,
      checkItem: row['チェック項目'],
      measure: row['対策計画'],
      risk: row['リスク']
    });
  });

  result.forEach(category => {
    delete category._subcategoryMap;
  });

  return result;
};