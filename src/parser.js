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
    // APIのキー名(DaiItem, ChuItem)に合わせて修正
    const categoryName = row.DaiItem;
    const subcategoryName = row.ChuItem;

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

    // こちらもAPIのキー名に合わせて修正
    // また、SurveyForm.jsxが期待するプロパティ名 (question) に合わせる
    subcategory.items.push({
      id: `check-item-${itemId++}`,
      question: row.CheckItem, // "question"というキー名で質問文をセット
      risk: row.Risk,
      
      // ★★★ ここが重要 ★★★
      // APIから受け取ったTargetEvaluation（対策評価）のJSON文字列を
      // JavaScriptの配列オブジェクトに変換し、"options"というキー名でセットする
      options: JSON.parse(row.TargetEvaluation)
    });
  });

  result.forEach(category => {
    delete category._subcategoryMap;
  });

  return result;
};