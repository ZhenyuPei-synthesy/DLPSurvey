// src/parser.js

/**
 * Azure SQL Databaseから読み込んだフラットなデータ配列を、階層構造を持つJSONに変換します。
 * SSISで投入されたアンケートデータを、フロントエンド表示用の構造に変換します。
 * @param {Array<Object>} data - 各行がオブジェクトになったデータの配列。
 * @returns {Array<Object>} 階層化されたJSONデータ。
 */
export const parseExcelDataToJson = (data) => {
  console.log('🔧 Parser: Starting parseExcelDataToJson with data length:', data?.length);
  
  const result = [];
  const categoryMap = new Map();
  let itemId = 1;

  data.forEach((row, index) => {
    if (index < 3) {
      console.log(`🔧 Parser: Processing row ${index}:`, row);
    }
    
    // APIのキー名(DaiItem, ChuItem)に合わせて修正
    const categoryName = row.DaiItem;
    const subcategoryName = row.ChuItem;

    console.log(`🔧 Parser: Row ${index} - Category: ${categoryName}, Subcategory: ${subcategoryName}`);

    let category = categoryMap.get(categoryName);
    if (!category) {
      console.log(`🔧 Parser: Creating new category: ${categoryName}`);
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
      console.log(`🔧 Parser: Creating new subcategory: ${subcategoryName}`);
      subcategory = {
        name: subcategoryName,
        items: []
      };
      category.subcategories.push(subcategory);
      category._subcategoryMap.set(subcategoryName, subcategory);
    }

    // こちらもAPIのキー名に合わせて修正
    // また、SurveyForm.jsxが期待するプロパティ名 (question) に合わせる
    try {
      console.log(`🔧 Parser: Adding item ${itemId} to subcategory`);
      subcategory.items.push({
        id: `check-item-${itemId++}`,
        question: row.CheckItem, // "question"というキー名で質問文をセット
        risk: row.Risk,
        
        // ★★★ 修正：TargetEvaluationはテキストデータなので、標準的な評価オプションを生成 ★★★
        // Azure SQL Databaseから取得したデータは、TargetEvaluationがプレーンテキストになっているため
        // フロントエンド用の選択肢オプションを動的に生成する
        options: JSON.parse(row.TargetEvaluation || '[]')
      });
    } catch (parseError) {
      console.error(`❌ Parser: Error processing row ${index}:`, parseError);
      throw parseError;
    }
  });

  result.forEach(category => {
    delete category._subcategoryMap;
  });

  console.log('🔧 Parser: Parsing completed. Categories created:', result.length);
  console.log('🔧 Parser: First category sample:', result[0]);

  return result;
};