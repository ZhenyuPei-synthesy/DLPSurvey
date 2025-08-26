// src/parser.js

/**
 * Azure SQL Databaseから読み込んだフラットなデータ配列を、階層構造を持つJSONに変換します。
 * SSISで投入されたアンケートデータを、フロントエンド表示用の構造に変換します。
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
      
      // ★★★ 修正：TargetEvaluationはテキストデータなので、標準的な評価オプションを生成 ★★★
      // Azure SQL Databaseから取得したデータは、TargetEvaluationがプレーンテキストになっているため
      // フロントエンド用の選択肢オプションを動的に生成する
      options: [
        { score: 1, text: "レベル1: 基本的な対策" },
        { score: 2, text: "レベル2: 標準的な対策" },
        { score: 3, text: "レベル3: 強化された対策" },
        { score: 4, text: "レベル4: 高度な対策" },
        { score: 5, text: "レベル5: 最高レベルの対策" }
      ]
    });
  });

  result.forEach(category => {
    delete category._subcategoryMap;
  });

  return result;
};