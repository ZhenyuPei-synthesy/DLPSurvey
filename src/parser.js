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

  // TargetEvaluation を安全にパースして {score,text} の配列を返すヘルパー
  const parseTargetEvaluation = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val !== 'string') return [];

    const raw = val.trim();
    // JSONらしければ試しに parse
    if (raw.startsWith('[') || raw.startsWith('{')) {
      try { return JSON.parse(raw); } catch (e) { console.warn('🔧 Parser: JSON.parse failed for TargetEvaluation, fallback to text parse', e); }
    }

    // 改行・カンマ・セミコロン・縦棒・読点などで分割して候補を作る
    const parts = raw.split(/\r?\n|;|\||、|,/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return [];

    return parts.map((p, i) => {
      // "1. テキスト" のような先頭番号を抽出
      const m = p.match(/^\s*(\d+)[\.)）]?\s*(.*)$/);
      if (m) {
        return { score: Number(m[1]), text: m[2].trim() };
      }
      // 数字がない場合はインデックスをスコアに使う（1始まり）
      return { score: i + 1, text: p };
    });
  };

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
      // 同一サブカテゴリ内で同じ質問テキストが既に存在する場合は
      // その既存アイテムに対策評価(option)を追加する（重複除去）
      const questionText = row.CheckItem || '';
      // Support two possible shapes from the API:
      // - legacy: TargetEvaluation is a string containing options
      // - newer: Options is already an array of { Score, Text } or {score,text}
      let parsedOptions = [];
      if (Array.isArray(row.Options) && row.Options.length > 0) {
        // Map API option objects to parser's {score,text} shape
        parsedOptions = row.Options.map(o => {
          // support different casing (Score or score, Text or text)
          const score = (o && (o.Score !== undefined ? o.Score : o.score)) ?? null;
          const text = (o && (o.Text !== undefined ? o.Text : o.text)) ?? '';
          return { score: score, text: String(text).trim() };
        }).filter(Boolean);
      } else if (row.TargetEvaluation) {
        parsedOptions = parseTargetEvaluation(row.TargetEvaluation);
      } else if (row.OptionRaw) {
        // compatibility: some payloads may use OptionRaw
        parsedOptions = parseTargetEvaluation(row.OptionRaw);
      } else {
        parsedOptions = [];
      }
      const existingItem = subcategory.items.find(it => it.question === questionText);
      if (existingItem) {
        existingItem.options = existingItem.options || [];
        // 質問番号が設定されていない場合は設定
        if (!existingItem.questionNumber && row.QuestionNumber) {
          existingItem.questionNumber = row.QuestionNumber;
        }
        // 中項目番号が設定されていない場合は設定
        if (!existingItem.chuItemNumber && row.ChuItemNumber) {
          existingItem.chuItemNumber = row.ChuItemNumber;
        }
        // parsedOptions を既存 options にマージ（text または score で重複排除）
        parsedOptions.forEach(opt => {
          const isDup = existingItem.options.some(o => (o.text && opt.text && o.text === opt.text) || (o.score !== undefined && opt.score !== undefined && o.score === opt.score));
          if (!isDup) existingItem.options.push(opt);
        });
        // 必要ならリスクを最新値で更新（ファイル上は同一なので任意）
        if (!existingItem.risk && row.Risk) existingItem.risk = row.Risk;
        if (!existingItem.relatedRegulations && row.RelatedLaw) existingItem.relatedRegulations = row.RelatedLaw;
        if (!existingItem.targetDepartment && row.TargetDepartment) existingItem.targetDepartment = row.TargetDepartment;
      } else {
        subcategory.items.push({
          id: `check-item-${itemId++}`,
          questionNumber: row.QuestionNumber || '', // 質問番号を追加
          chuItemNumber: row.ChuItemNumber || '', // 中項目番号を追加
          question: questionText, // "question"というキー名で質問文をセット
          risk: row.Risk,
          relatedRegulations: row.RelatedLaw,
          targetDepartment: row.TargetDepartment || '', // 想定回答部門を追加
          options: parsedOptions
        });
      }
    } catch (parseError) {
      console.error(`❌ Parser: Error processing row ${index}:`, parseError, 'row:', row);
      // 全体を止めずに空のoptionsで継続
      subcategory.items.push({
        id: `check-item-${itemId++}`,
        questionNumber: row.QuestionNumber || '', // 質問番号を追加
        question: row.CheckItem || '（質問文なし）',
        risk: row.Risk || '',
        relatedRegulations: row.RelatedLaw || '',
        targetDepartment: row.TargetDepartment || '', // 想定回答部門を追加
        options: []
      });
    }
  });

  result.forEach(category => {
    delete category._subcategoryMap;
  });

  console.log('🔧 Parser: Parsing completed. Categories created:', result.length);
  console.log('🔧 Parser: First category sample:', result[0]);

  return result;
};

/**
 * 部門フィルターを適用して、指定した部門の質問のみを表示します。
 * @param {Array<Object>} structuredData - parseExcelDataToJsonで変換されたデータ
 * @param {string} selectedDepartment - 選択された部門名（"すべて"の場合は全て表示）
 * @returns {Array<Object>} フィルタリングされたデータ
 */
export const applyDepartmentFilter = (structuredData, selectedDepartment) => {
  if (!structuredData || !Array.isArray(structuredData)) {
    return [];
  }

  // "すべて"が選択された場合はフィルタリングしない
  if (selectedDepartment === 'すべて') {
    return structuredData;
  }

  // フィルタリングを適用
  return structuredData.map(category => ({
    ...category,
    subcategories: category.subcategories.map(subcategory => ({
      ...subcategory,
      items: subcategory.items.filter(item => {
        // 想定回答部門が指定した部門と一致する場合、または部門が未設定の場合は表示
        return !item.targetDepartment || 
               item.targetDepartment === selectedDepartment ||
               item.targetDepartment.includes(selectedDepartment);
      })
    })).filter(subcategory => subcategory.items.length > 0) // 質問が1つもない中項目は除外
  })).filter(category => category.subcategories.length > 0); // 中項目が1つもない大項目は除外
};

/**
 * 利用可能な部門一覧を取得します。
 * @param {Array<Object>} structuredData - parseExcelDataToJsonで変換されたデータ
 * @returns {Array<string>} 部門名の配列
 */
export const getAvailableDepartments = (structuredData) => {
  if (!structuredData || !Array.isArray(structuredData)) {
    return ['すべて'];
  }

  const departments = new Set(['すべて']);

  structuredData.forEach(category => {
    category.subcategories.forEach(subcategory => {
      subcategory.items.forEach(item => {
        if (item.targetDepartment && item.targetDepartment.trim() !== '') {
          // 複数部門が含まれている場合は分割
          const depts = item.targetDepartment.split(/[,、]/);
          depts.forEach(dept => {
            const trimmed = dept.trim();
            if (trimmed) {
              departments.add(trimmed);
            }
          });
        }
      });
    });
  });

  return Array.from(departments);
};