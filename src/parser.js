/**
 * Azure SQL Database から取得したアンケートデータを階層構造JSONに変換
 * 
 * @description
 * DLP（Data Loss Prevention）調査用のフラットなデータベースレコードを、
 * React コンポーネントで表示可能な階層構造に変換します。
 * 
 * データ構造：
 * - 大項目（DaiItem）→ 中項目（ChuItem）→ チェック項目（CheckItem）
 * 
 * @param {Array<Object>} data - データベースから取得したレコード配列
 * @returns {Array<Object>} 階層化されたカテゴリデータ
 */
export const parseExcelDataToJson = (data) => {
  if (!data || !Array.isArray(data)) {
    throw new Error('無効なデータ形式です');
  }
  
  const result = [];
  const categoryMap = new Map();
  let itemId = 1;

  data.forEach((row, index) => {
    // データベースのカラム名（DaiItem, ChuItem, CheckItem, Risk）を使用
    const categoryName = row.DaiItem;
    const subcategoryName = row.ChuItem;
    
    if (!categoryName || !subcategoryName) {
      console.warn(`データ不備: 行${index} - カテゴリまたはサブカテゴリが空です`);
      return; // スキップ
    }

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

    // チェック項目をサブカテゴリに追加
    try {
      subcategory.items.push({
        id: `check-item-${itemId++}`,
        question: row.CheckItem,
        risk: row.Risk,
        
        // 標準的な5段階評価オプションを生成
        // データベースのTargetEvaluationフィールドは現在プレーンテキストのため
        options: [
          { score: 1, text: "レベル1: 基本的な対策" },
          { score: 2, text: "レベル2: 標準的な対策" },
          { score: 3, text: "レベル3: 強化された対策" },
          { score: 4, text: "レベル4: 高度な対策" },
          { score: 5, text: "レベル5: 最高レベルの対策" }
        ]
      });
    } catch (parseError) {
      console.error(`データ処理エラー - 行${index}:`, parseError.message);
      throw parseError;
    }
  });

  // 内部使用のMapプロパティを削除
  result.forEach(category => {
    delete category._subcategoryMap;
  });

  return result;
};