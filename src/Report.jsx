// レーダーチャートのラベルを2行表示（1行目:カテゴリ名, 2行目:点数）
const customRadarLabelPlugin = {
  id: 'customRadarLabelPlugin',
  afterDraw: (chart) => {
    if (!chart.scales?.r) return;
    const scale = chart.scales.r;
    const ctx = chart.ctx;
    const chartData = chart.data;
    const categories = chartData.labels;
    const categoryScores = chartData.datasets[0]?.data || [];
    const targetScores = chartData.datasets[1]?.data || [];
    categories.forEach((category, i) => {
      const avgScore = Number(categoryScores[i]) || 0;
      const targetScore = Number(targetScores[i]) || 0;
      const opts = scale.options.pointLabels;
      const pos = scale.getPointLabelPosition(i);
      // 1行目: カテゴリ名（通常）
      ctx.save();
      ctx.font = `${opts.font.weight || ''} ${opts.font.size || 16}px Arial`;
      ctx.fillStyle = opts.color || '#1f2937';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(category, pos.x, pos.y - 10);
      ctx.restore();
      // 2行目: 点数（太字）
      ctx.save();
      ctx.font = `bold ${(opts.font.size || 16)}px Arial`;
      ctx.fillStyle = opts.color || '#1f2937';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${avgScore.toFixed(1)} / ${targetScore.toFixed(1)}`, pos.x, pos.y + 12);
      ctx.restore();
    });
  }
};
ChartJS.register(customRadarLabelPlugin);
import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const Report = ({ answers, surveyData }) => {
  const [aiEvaluations, setAiEvaluations] = useState({});
  const [loadingEvaluations, setLoadingEvaluations] = useState(true);
  const [targetScores, setTargetScores] = useState({});
  const [showRespondentForm, setShowRespondentForm] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false); // ダウンロード完了フラグ
  const [expandedCategories, setExpandedCategories] = useState({}); // 評価軸ドロップダウンの開閉状態
  const [showEvaluationAxis, setShowEvaluationAxis] = useState(false); // 評価軸について全体の開閉状態
  const [showMaturityLevels, setShowMaturityLevels] = useState(false); // 成熟度のレベル定義の開閉状態
  const [respondentInfo, setRespondentInfo] = useState({
    company: '',
    department: '',
    jobTitle: '',
    name: '',
    email: '',
    phone: '',
    expertConsultation: '',
    benchmarkReport: ''
  });

  // 回答者情報を取得してダウンロード状態を確認
  useEffect(() => {
    const loadRespondentInfo = async () => {
      try {
        const storedRespondentId = sessionStorage.getItem('respondentId');
        if (!storedRespondentId) {
          return;
        }

        const apiUrl = import.meta.env.MODE === 'development' 
          ? '/api/GetRespondentInfo'
          : (import.meta.env.VITE_GET_RESPONDENT_INFO_API_URL || '/api/GetRespondentInfo');

        const response = await fetch(`${apiUrl}?respondentId=${storedRespondentId}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.respondentInfo) {
            const info = result.respondentInfo;
            
            // フォームには自動入力しない - ダウンロード状態の確認のみ行う
            // データベースの値に基づいてダウンロード状態を設定
            const isAlreadyDownloaded = info.registrationAndDownloadStatus === '登録及びダウンロード済み';
            setIsDownloaded(isAlreadyDownloaded);
          }
        }
      } catch (err) {
        console.error("回答者情報の読み込み中にエラー:", err);
      }
    };

    loadRespondentInfo();
  }, []);

  // AI評価データを読み込む
  useEffect(() => {
    const loadAiEvaluations = async () => {
      try {
        const storedRespondentId = sessionStorage.getItem('respondentId');
        if (!storedRespondentId) {
          setLoadingEvaluations(false);
          return;
        }

        const apiUrl = import.meta.env.MODE === 'development' 
          ? '/api/GetEvaluationStatus'
          : (import.meta.env.VITE_GET_EVALUATION_STATUS_API_URL || '/api/GetEvaluationStatus');

        const response = await fetch(`${apiUrl}?respondentId=${storedRespondentId}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.evaluations && result.evaluations.length > 0) {
            const evaluationMap = {};
            
            // 中項目番号でマッピング
            result.evaluations.forEach(evaluation => {
              const subcategoryId = evaluation.subcategoryId || evaluation.SubcategoryId || '';
              const status = (evaluation.status || evaluation.Status || '').toLowerCase();
              
              if (status === 'completed') {
                evaluationMap[subcategoryId] = {
                  evaluationText: evaluation.evaluationText || evaluation.EvaluationText || '',
                  recommendationText: evaluation.recommendationText || evaluation.RecommendationText || ''
                };
              }
            });
            
            setAiEvaluations(evaluationMap);
            console.log('AI評価データを読み込み完了:', evaluationMap);
          }
        }
      } catch (err) {
        console.error("AI評価データの読み込み中にエラー:", err);
      } finally {
        setLoadingEvaluations(false);
      }
    };

    if (surveyData.length > 0) {
      loadAiEvaluations();
    }
  }, [surveyData]);

  // 目標スコアの初期化
  useEffect(() => {
    if (surveyData.length > 0) {
      const initialTargetScores = {};
      surveyData.forEach(category => {
        // ここで各カテゴリの目標スコアを直接設定
        switch(category.category) {
          case '1. 全社的・組織的管理':
            initialTargetScores[category.category] = 3.7;
            break;
          case '2. 人的管理':
            initialTargetScores[category.category] = 3.5;
            break;
          case '3. 物理的管理':
            initialTargetScores[category.category] = 3.5;
            break;
          case '4. 技術的・IT管理':
            initialTargetScores[category.category] = 3.5;
            break;
          case '5. サプライチェーン・外部連携管理':
            initialTargetScores[category.category] = 3.6;
            break;
          default:
            initialTargetScores[category.category] = 3.4;
        }
      });
      setTargetScores(initialTargetScores);
    }
  }, [surveyData]);
  // ダウンロード処理を実行する関数（元のdownloadPDF）
  const executeDownload = async () => {
    try {
      // 企業名を取得（respondentInfoから、なければデフォルト値）
      const companyName = respondentInfo.company || '企業名未設定';
      
      // すべてのダウンロードボタンを一時的に隠す
      const downloadBtns = document.querySelectorAll('.download-btn');
      downloadBtns.forEach(btn => btn.style.display = 'none');
      
      // 少し待ってからキャプチャ（レンダリング完了を待つ）
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = document.getElementById('report-content');
      
      // html2canvasの設定を改善
      const canvas = await html2canvas(element, {
        scale: 3, // より高解像度
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true, // テキストレンダリング改善
        foreignObjectRendering: false, // SVGレンダリング改善
        imageTimeout: 15000,
        removeContainer: true,
        width: element.scrollWidth,
        height: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200, // 固定幅でレンダリング
        windowHeight: element.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95); // JPEG形式で圧縮率改善
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth - 20; // マージンを考慮
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // ページ分割の改善
      let yPosition = 10; // 上マージン
      const pageHeight = pdfHeight - 20; // 上下マージンを考慮
      
      if (imgHeight <= pageHeight) {
        // 1ページに収まる場合
        pdf.addImage(imgData, 'JPEG', 10, yPosition, imgWidth, imgHeight);
      } else {
        // 複数ページに分割
        let remainingHeight = imgHeight;
        let sourceY = 0;
        
        while (remainingHeight > 0) {
          const currentPageHeight = Math.min(remainingHeight, pageHeight);
          const sourceHeight = (currentPageHeight * canvas.height) / imgHeight;
          
          // 現在のページ用のキャンバスを作成
          const pageCanvas = document.createElement('canvas');
          const pageCtx = pageCanvas.getContext('2d');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          
          // 背景を白に設定
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          
          // 元のキャンバスから該当部分を描画
          pageCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, pageCanvas.width, pageCanvas.height
          );
          
          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          
          if (sourceY > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(pageImgData, 'JPEG', 10, 10, imgWidth, currentPageHeight);
          
          sourceY += sourceHeight;
          remainingHeight -= currentPageHeight;
        }
      }
      
      // ファイル名を指定の形式で生成
      const filename = `AI時代の内部情報漏洩対策アセスメント結果.pdf`;
      pdf.save(filename);
      
      // ダウンロードボタンを再表示
      downloadBtns.forEach(btn => btn.style.display = 'inline-flex');
      
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert('PDFの生成中にエラーが発生しました。');
      
      // エラー時もボタンを再表示
      const downloadBtns = document.querySelectorAll('.download-btn');
      downloadBtns.forEach(btn => btn.style.display = 'inline-flex');
    }
  };

  // ダウンロードボタンがクリックされた時の処理
  const handleDownloadClick = () => {
    // すでにダウンロード済みの場合は何もしない
    if (isDownloaded) {
      return;
    }
    setShowRespondentForm(true);
  };

  // 回答者情報の入力値を更新
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRespondentInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // キャンセルボタンの処理
  const handleCancel = () => {
    setShowRespondentForm(false);
    // データベースから取得した情報があればそれを保持、なければ空にする
    // （新規の場合のみリセット）
  };

  // 登録してダウンロードボタンの処理
  const handleRegisterAndDownload = async () => {
    // 必須項目のバリデーション
    if (!respondentInfo.company.trim()) {
      alert('会社名は必須項目です。');
      return;
    }
    if (!respondentInfo.name.trim()) {
      alert('氏名は必須項目です。');
      return;
    }
    if (!respondentInfo.expertConsultation) {
      alert('専門家による詳細な改善提案の希望要否をお選びください。');
      return;
    }
    if (!respondentInfo.benchmarkReport) {
      alert('業界ベンチマークレポートの統計利用への協力要否をお選びください。');
      return;
    }

    try {
      // RespondentIdを取得
      const storedRespondentId = sessionStorage.getItem('respondentId');
      if (!storedRespondentId) {
        alert('回答者IDが見つかりません。再度アンケートを開始してください。');
        return;
      }

      // ポップアップを先に閉じてユーザーエクスペリエンスを向上
      setShowRespondentForm(false);

      // Respondentテーブルの更新とダウンロード処理を並行実行
      const apiUrl = import.meta.env.MODE === 'development' 
        ? '/api/CreateRespondent'
        : (import.meta.env.VITE_CREATE_RESPONDENT_API_URL || '/api/CreateRespondent');

      const respondentData = {
        respondentId: storedRespondentId,
        company: respondentInfo.company.trim(),
        department: respondentInfo.department.trim() || null,
        jobTitle: respondentInfo.jobTitle.trim() || null,
        name: respondentInfo.name.trim(),
        email: respondentInfo.email.trim() || null,
        phone: respondentInfo.phone.trim() || null,
        expertConsultation: respondentInfo.expertConsultation,
        benchmarkReport: respondentInfo.benchmarkReport,
        registrationAndDownloadStatus: "登録及びダウンロード済み"
      };

      // API保存とダウンロード処理を並行実行
      const saveRespondentPromise = fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(respondentData)
      });

      const downloadPromise = executeDownload();

      // 両方の処理を並行実行し、API保存の結果をチェック
      const [saveResponse] = await Promise.allSettled([saveRespondentPromise, downloadPromise]);
      
      // ダウンロード完了フラグを設定
      setIsDownloaded(true);
      
      // API保存の結果をログに出力（ダウンロードには影響しない）
      if (saveResponse.status === 'fulfilled') {
        if (saveResponse.value.ok) {
          const result = await saveResponse.value.json();
          if (result.success) {
            console.log('回答者情報を正常に保存しました:', respondentData);
          } else {
            console.warn('回答者情報の保存に失敗しましたが、ダウンロードは実行されました:', result.message);
          }
        } else {
          console.warn(`回答者情報の保存でHTTPエラーが発生しましたが、ダウンロードは実行されました: ${saveResponse.value.status}`);
        }
      } else {
        console.warn('回答者情報の保存中にエラーが発生しましたが、ダウンロードは実行されました:', saveResponse.reason);
      }

    } catch (error) {
      console.error('回答者情報の保存中にエラーが発生しました:', error);
      alert('回答者情報の保存中にエラーが発生しました。もう一度お試しください。');
    }
  };

  // 評価軸ドロップダウンの開閉を管理
  const toggleCategoryExpanded = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  // カテゴリごとの平均スコアを計算
  const calculateCategoryScores = () => {
    const categoryScores = {};
    
    surveyData.forEach(category => {
      let totalScore = 0;
      let itemCount = 0;
      
      category.subcategories.forEach(subcategory => {
        subcategory.items.forEach(item => {
          const answer = answers[item.id];
          if (answer && answer.score !== undefined) {
            totalScore += parseInt(answer.score);
            itemCount++;
          }
        });
      });
      
  categoryScores[category.category] = itemCount > 0 ? (totalScore / itemCount) : 0;
    });
    
    return categoryScores;
  };

  // サブカテゴリごとのコメントを取得
  const getSubcategoryComments = () => {
    const subcategoryData = [];
    
    surveyData.forEach(category => {
      category.subcategories.forEach(subcategory => {
        let totalScore = 0;
        let itemCount = 0;
        const comments = [];
        
        subcategory.items.forEach(item => {
          const answer = answers[item.id];
          if (answer && answer.score !== undefined) {
            totalScore += parseInt(answer.score);
            itemCount++;
          }
          if (answer && answer.comment) {
            comments.push({
              question: item.question,
              comment: answer.comment
            });
          }
        });
        
        const averageScore = itemCount > 0 ? (totalScore / itemCount).toFixed(2) : 0;
        
        subcategoryData.push({
          category: category.category,
          subcategory: subcategory.name,
          averageScore,
          comments,
          hasAnswers: itemCount > 0
        });
      });
    });
    
    return subcategoryData;
  };

  // 詳細評価シートのデータを取得
  const getDetailedEvaluationData = () => {
    const detailData = [];
    
    surveyData.forEach(category => {
      category.subcategories.forEach(subcategory => {
        subcategory.items.forEach(item => {
          const answer = answers[item.id];
          
          detailData.push({
            id: item.id,
            question: item.question,
            score: answer?.score || '未評価',
            comment: answer?.comment || '-',
            risk: item.risk || '-',
            relatedLaw: item.relatedRegulations || '-'
          });
        });
      });
    });
    
    return detailData;
  };

  const categoryScores = calculateCategoryScores();
  const subcategoryData = getSubcategoryComments();
  const detailData = getDetailedEvaluationData();

  // レーダーチャートのデータ - useMemoでtargetScoresの変更を確実に反映
  const radarData = useMemo(() => {
    return {
      labels: Object.keys(categoryScores), // カテゴリ名のみ
      datasets: [
        {
          label: '平均スコア',
          data: Object.values(categoryScores),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        },
        {
          label: '目標スコア（当社推奨）',
          data: Object.keys(categoryScores).map(category => {
            const targetScore = targetScores[category] || 3.5;
            return targetScore;
          }),
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: 'rgba(34, 197, 94, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(34, 197, 94, 1)',
        },
      ],
    };
  }, [categoryScores, targetScores]);

  const radarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 5,
        ticks: {
          stepSize: 1,
        },
        pointLabels: {
          font: {
            size: 12,
            weight: 'normal',
          },
          color: '#1f2937',
          padding: 30,
          align: 'center',
          display: true,
          callback: (label, index) => {
            // 1行の最大文字数
            const maxLen = 20;
            // 長いカテゴリ名は自動改行
            let lines = [];
            for (let i = 0; i < label.length; i += maxLen) {
              lines.push(label.slice(i, i + maxLen));
            }
            const avgScore = Number(Object.values(categoryScores)[index] ?? 0).toFixed(1);
            const targetScore = Number(Object.values(targetScores)[index] ?? 3.5).toFixed(1);
            lines.push(`${avgScore} / ${targetScore}`);
            return lines;
          },
        },
      },
    },
  }), [categoryScores, targetScores]);

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 font-sans">
      <style jsx>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        
        /* PDF生成時のレイアウト改善 */
        #report-content {
          font-size: 14px;
          line-height: 1.4;
        }
        
        #report-content table {
          page-break-inside: avoid;
        }
        
        #report-content .bg-white {
          page-break-inside: avoid;
          margin-bottom: 20px;
        }
        
        #report-content .rounded-lg {
          border-radius: 8px;
        }
        
        /* テーブル内の文字切れ防止 */
        #report-content table td {
          word-wrap: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
        }
        
        /* 評価点の円形バッジの改善 */
        #report-content .inline-flex.items-center.px-2\\.5.py-0\\.5 {
          display: inline-block !important;
          text-align: center;
          min-width: 40px;
          height: 24px;
          line-height: 24px;
          padding: 0 8px;
        }
      `}</style>
      
      {/* 回答者情報入力ポップアップ */}
      {showRespondentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-[900px] max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">回答者情報入力</h2>
              <p className="text-sm text-gray-600 mb-6">
                レポートをダウンロードする前に、以下の情報をご入力ください。
              </p>
              
              <div className="space-y-4">
                {/* 会社名（必須） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    会社名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={respondentInfo.company}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="株式会社○○○"
                    required
                  />
                </div>

                {/* 部署名（任意） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    部署名
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={respondentInfo.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="情報システム部"
                  />
                </div>

                {/* 役職（任意） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    役職
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={respondentInfo.jobTitle}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="部長"
                  />
                </div>

                {/* 氏名（必須） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={respondentInfo.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="山田 太郎"
                    required
                  />
                </div>

                {/* メールアドレス（任意） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={respondentInfo.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="example@company.com"
                  />
                </div>

                {/* 電話番号（任意） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={respondentInfo.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="03-1234-5678"
                  />
                </div>

                {/* ご協力いただいた企業様への特典 */}
                <div className="border-t pt-4 mt-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">ご協力いただいた企業様への特典</h3>
                  
                  {/* AIによる簡易診断レポート */}
                  <div className="mb-4">
                    <div className="flex items-start mb-2">
                      <div className="w-2 h-2 bg-gray-800 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                      <div>
                        <span className="font-medium text-gray-800">AIによる簡易診断レポート</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 ml-4 mb-3">
                      回答後すぐに、現状の強みと課題をまとめたレポートをダウンロードいただけます。
                    </p>
                  </div>

                  {/* 専門家による詳細な改善提案 */}
                  <div className="mb-4">
                    <div className="flex items-start mb-2">
                      <div className="w-2 h-2 bg-gray-800 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                      <div>
                        <span className="font-medium text-gray-800">専門家による詳細な改善提案</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 ml-4 mb-3">
                      ご希望の企業様には、専門家が結果を分析し、改善策とロードマップをご提案します。
                    </p>
                    <div className="ml-4 flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="expertConsultation"
                          value="希望する"
                          checked={respondentInfo.expertConsultation === '希望する'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-sm">希望する</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="expertConsultation"
                          value="希望しない"
                          checked={respondentInfo.expertConsultation === '希望しない'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-sm">希望しない</span>
                      </label>
                    </div>
                  </div>

                  {/* 業界ベンチマークレポートのご提供 */}
                  <div className="mb-4">
                    <div className="flex items-start mb-2">
                      <div className="w-2 h-2 bg-gray-800 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                      <div>
                        <span className="font-medium text-gray-800">業界ベンチマークレポートのご提供</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 ml-4 mb-3">
                      ベンチマークレポートの統計利用にご協力いただける企業様には、3ヶ月後に業界ベンチマークレポートを無償でご提供します。
                    </p>
                    <div className="ml-4 flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="benchmarkReport"
                          value="協力する"
                          checked={respondentInfo.benchmarkReport === '協力する'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-sm">協力する</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="benchmarkReport"
                          value="協力しない"
                          checked={respondentInfo.benchmarkReport === '協力しない'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        <span className="text-sm">協力しない</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* ボタン */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleRegisterAndDownload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  登録してダウンロード
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* PDFダウンロードボタン */}
        <div className="text-center mb-6">
          <button
            onClick={handleDownloadClick}
            disabled={isDownloaded}
            className={`download-btn inline-flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              isDownloaded 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isDownloaded ? 'ダウンロード済み' : 'ダウンロード'}
          </button>
        </div>

        <div id="report-content">

        {/* レーダーチャートセクション */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">評価結果レポート</h2>
          
          <div className="flex flex-col lg:flex-row items-start justify-center gap-8 max-w-6xl mx-auto">
            {/* レーダーチャート */}
            <div className="flex-1 w-full max-w-lg h-96 flex justify-center">
              <Radar 
                data={radarData} 
                options={radarOptions} 
              />
            </div>

            {/* 総合評価結果 */}
            <div className="flex-1 w-full max-w-lg">
              <div className="bg-white p-6 rounded-lg border border-gray-200 h-full">
                <h3 className="text-lg font-bold text-start mb-4">総合評価</h3>
                
                {/* 点数表示 */}
                <div className="text-start mb-4">
                  {(() => {
                    const totalAverage = Object.values(categoryScores).reduce((sum, score) => sum + Number(score), 0) / Object.values(categoryScores).length;
                    
                    // レベル判定
                    let level, levelName;
                    if (totalAverage <= 1) {
                      level = 1;
                      levelName = "無防備";
                    } else if (totalAverage <= 2.99) {
                      level = 2;
                      levelName = "部分防御";
                    } else if (totalAverage < 3.99) {
                      level = 3;
                      levelName = "組織的防御";
                    } else if (totalAverage <= 4.99) {
                      level = 4;
                      levelName = "動的防御";
                    } else {
                      level = 5;
                      levelName = "予測的防御";
                    }

                    return (
                      <>
                        <div className="text-4xl font-bold text-blue-600 mb-2">
                          {totalAverage.toFixed(1)} / 5.0
                        </div>
                        <div className="text-lg font-semibold text-gray-700">
                          成熟度レベル{level}：{levelName}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 薄青枠：総合評価文 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  {(() => {
                    const totalAverage = Object.values(categoryScores).reduce((sum, score) => sum + Number(score), 0) / Object.values(categoryScores).length;
                    
                    let levelDescription;
                    if (totalAverage <= 1) {
                      levelDescription = "対策が場当たり的で、ルールやプロセスが存在しない状態。個人の努力や暗黙知に依存しており、組織的な管理は行われていない。リスクの認識も限定的。";
                    } else if (totalAverage <= 2.99) {
                      levelDescription = "一部の部門や担当者によって個別の対策が実施されているが、全社で一貫しておらず、サイロ化している状態。ルールは存在するが、非公式であったり形骸化している。";
                    } else if (totalAverage <= 3.99) {
                      levelDescription = "全社的な方針やルールが文書化され、関係者に周知されている状態。対策プロセスが定義され、一貫性のある対応が可能になっているが、その効果測定は限定的。";
                    } else if (totalAverage <= 4.99) {
                      levelDescription = "標準化されたプロセスが定着し、対策の実施状況や効果がデータに基づいて定量的に測定・評価されている状態。リスク評価に基づき、継続的な改善活動が行われている。";
                    } else {
                      levelDescription = "データ保護が組織文化として定着し、事業戦略の一部として位置づけられている状態。自動化技術などを活用して継続的な改善が自律的に行われ、脅威に対しプロアクティブに対応できる。";
                    }

                    return (
                      <p className="text-sm text-gray-700">
                        {levelDescription}
                      </p>
                    );
                  })()}
                </div>

                {/* 黄色枠：中項目分析セクション */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-yellow-400 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      {/* 中項目分析セクション - 最高点・最低点項目の表示 */}
                      {(() => {
                        // 回答済みの中項目データを取得
                        const answeredSubcategories = subcategoryData.filter(sub => sub.hasAnswers);
                        
                        if (answeredSubcategories.length === 0) {
                          return null;
                        }

                        // スコアでソート
                        const sortedByScore = [...answeredSubcategories].sort((a, b) => 
                          parseFloat(b.averageScore) - parseFloat(a.averageScore)
                        );

                        const highest = sortedByScore[0];
                        const lowest = sortedByScore[sortedByScore.length - 1];

                        return (
                          <div className="">
                            <h4 className="text-sm font-bold text-yellow-800 mb-3">あなたの組織の強みと改善ポイント</h4>
                            
                            <div className="space-y-3">
                              {/* 強み（最高点項目） */}
                              {parseFloat(highest.averageScore) >= 3 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                      <svg className="w-4 h-4 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <div className="ml-2 flex-1">
                                      <div className="text-xs font-medium text-green-800 mb-1">
                                        🌟 強み: {highest.subcategory} ({parseFloat(highest.averageScore).toFixed(1)}点)
                                      </div>
                                      <div className="text-xs text-green-700">
                                        この分野での優れた取り組みが確認できます。この強みを他の分野にも展開することを検討してみてください。
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* 改善ポイント（最低点項目） */}
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <div className="flex items-start">
                                  <div className="flex-shrink-0">
                                    <svg className="w-4 h-4 text-orange-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="ml-2 flex-1">
                                    <div className="text-xs font-medium text-orange-800 mb-1">
                                      🔧 改善ポイント: {lowest.subcategory} ({parseFloat(lowest.averageScore).toFixed(1)}点)
                                    </div>
                                    <div className="text-xs text-orange-700">
                                      この分野での対策強化をお勧めします。まずは現状の課題を整理し、優先順位をつけて取り組むことから始めましょう。
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 評価軸について */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <button
            onClick={() => setShowEvaluationAxis(!showEvaluationAxis)}
            className="w-full flex items-center justify-between mb-6"
          >
            <h2 className="text-2xl font-bold">評価軸について</h2>
            <svg
              className={`w-6 h-6 transition-transform ${
                showEvaluationAxis ? 'transform rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showEvaluationAxis && (
            <div>
              {surveyData.map((category) => {
                // カテゴリごとの詳細説明を定義
                const getCategoryDescription = (categoryName) => {
                  switch(categoryName) {
                    case '1. 全社的・組織的管理':
                      return {
                        definition: '経営層のリーダーシップのもと、全社横断的な体制を構築し、情報管理に関する方針や規程を定め、継続的に運用・改善していくことです。これは、データセキュリティを個別の技術的問題ではなく、企業価値の維持・向上に直結する経営課題として捉えるアプローチです。',
                        points: [
                          '経営層の主導：経営層がデータセキュリティへの取り組み姿勢を明確に示し、必要なリソース（予算・人員）を確保することが不可欠です。',
                          '部門横断的な体制構築：IT、法務、人事、各事業部門などから成る部門横断的なチーム（例：秘密情報管理委員会）を設置し、全社的な意思決定と連携を図ります。',
                          '方針と規程の策定：守るべき情報の特定、分類基準、取り扱いルールなどを盛り込んだ全社的な情報管理規程を策定し、全従業員に周知徹底します。',
                          '戦略的な目標設定：自社のリスク許容度を明確にし、データセキュリティ対策によって何を実現するのか、具体的な成功指標を定義して取り組みます。'
                        ]
                      };
                    case '2. 人的管理':
                      return {
                        definition: '従業員や役員など、情報にアクセスするすべての人々に対し、教育・訓練を実施し、秘密保持に関する意識を高め、規律を遵守させるための管理策です。情報漏洩の多くは内部関係者に起因するため、最も重要な対策の一つとされています。',
                        points: [
                          '契約・誓約による義務の明確化：入社時から退職時に至るまで、秘密保持に関する誓約書や契約を締結し、従業員が負うべき法的義務を明確に認識させます。',
                          '継続的な教育と意識向上：情報セキュリティに関する研修を定期的に実施し、情報漏洩のリスクや社内ルール、具体的な事例などを周知することで、従業員のセキュリティ意識を高めます。',
                          '退職者管理の徹底：従業員の退職時には、貸与したPCや記録媒体を確実に返却させ、システムへのアクセス権限を速やかに削除します。',
                          '信頼関係の構築：公平な人事評価や働きやすい職場環境を整備することで、従業員のエンゲージメントを高め、内部不正の動機となる不満を低減させます。'
                        ]
                      };
                    case '3. 物理的管理':
                      return {
                        definition: '秘密情報が記録された書類、記録媒体、サーバ、製造設備などへの物理的なアクセスを制限し、盗難や不正な持ち出し、覗き見などを防ぐための管理策です。',
                        points: [
                          '区域管理（ゾーニング）：秘密情報を扱うエリアを特定し、施錠管理や入退室管理システムを導入して、権限のない者の立ち入りを物理的に制限します。',
                          '媒体の施錠保管：秘密情報が記録された書類やUSBメモリなどの記録媒体は、施錠可能なキャビネットや金庫で保管します。',
                          '持ち込み・持ち出しの制限：私物のPCやUSBメモリの業務利用や、重要情報が保管されているエリアへの持ち込みを制限します。また、退社時の手荷物検査なども有効です。',
                          '安全な廃棄：不要になった秘密情報が記録された媒体は、シュレッダーによる裁断や専門業者による溶解・物理破壊など、復元不可能な方法で廃棄します。'
                        ]
                      };
                    case '4. 技術的・IT管理':
                      return {
                        definition: '情報システムやネットワークの機能を活用して、データへのアクセス制御、不正アクセスの検知・防御、データの暗号化、操作履歴の記録などを行う技術的な管理策です。',
                        points: [
                          'アクセス制御の徹底：「知る必要のある者だけが知る（Need to know）」の原則に基づき、ID・パスワードや多要素認証で本人確認を徹底し、従業員ごとにアクセスできる情報の範囲を必要最小限に限定します。',
                          'データの暗号化：ファイルや記録媒体、通信経路を暗号化することで、万が一データが外部に漏れても、第三者が内容を読み取ることを困難にします。',
                          'ログの取得と監視：誰が・いつ・どの情報にアクセスしたかというログを記録・保存し、定期的に監視することで、不正なアクセスやその兆候を早期に発見します。',
                          '漏洩対策ソリューションの導入：DLP（Data Loss Prevention）製品を導入し、メールやクラウドへのアップロードなどを監視して、機密情報の不正な外部送信を自動的に検知・ブロックします。'
                        ]
                      };
                    case '5. サプライチェーン・外部連携管理':
                      return {
                        definition: '業務委託先、共同研究開発パートナー、子会社など、自社の秘密情報を共有する外部組織における情報管理体制を確保し、サプライチェーン全体での情報漏洩リスクを低減させるための管理策です。',
                        points: [
                          '取引先の事前評価：取引を開始する前に、相手方の情報セキュリティ管理体制を評価し、信頼できる事業者を選定します。',
                          '契約による義務付け：秘密保持契約（NDA）を締結し、開示する情報の範囲、目的外利用の禁止、管理体制、再委託の条件、契約終了時の情報返却・廃棄義務などを明確に定めます。',
                          '開示情報の最小化：外部に開示する秘密情報は、業務上真に必要なものに限定し、取扱担当者も必要最小限に絞るよう相手方に要請します。',
                          '定期的な監査と状況確認：契約に基づき、委託先における情報管理の実施状況について定期的に報告を求め、必要に応じて監査を実施し、管理レベルが維持されていることを確認します。'
                        ]
                      };
                    case '6. AI活用におけるデータ管理':
                      return {
                        definition: '生成AIなどのAI技術を利用する際に、入力データに秘密情報が含まれることによる意図しない情報漏洩を防ぎ、安全な利活用を実現するための管理策です。',
                        points: [
                          '利用ルールの策定と周知：社内でのAI利用に関する明確なガイドラインを策定し、「どのような情報を入力してはいけないか」「どのAIサービスを利用してよいか」といったルールを全従業員に周知徹底します。',
                          'サービス内容の確認：外部の生成AIサービスを利用する際は、利用規約や契約を確認し、入力した情報がAIの学習データとして再利用されないかなど、情報の取り扱い方針を必ず確認します。',
                          '秘密情報の入力を禁止：原則として、営業秘密、個人情報、顧客情報などの機密情報を外部の生成AIに入力することを禁止します。',
                          '新たな脅威への対策：AIを悪用して巧妙化されたフィッシングメールなど、新たなセキュリティ脅威に対する従業員の警戒心を高めるための教育を実施します。'
                        ]
                      };
                    case '7. 限定提供データの管理':
                      return {
                        definition: '不正競争防止法で保護される「限定提供データ」（営業秘密には当たらないが、特定の相手に提供され、電磁的に管理されている価値あるデータ）を適切に管理し、不正な取得や利用を防ぐための管理策です。',
                        points: [
                          '限定提供性の確保：データを特定の者にのみ提供するものであることを契約等で明確にし、提供先がさらに第三者へ無断で提供することを禁止します。',
                          '電磁的管理性の確保：提供先以外がデータにアクセスできないように、ID・パスワードの設定や暗号化といった技術的な管理措置を講じます。',
                          '契約による管理：データの提供・利用に関するルールを契約で詳細に定め、目的外利用や不正な複製を禁止します。',
                          'データの特定：どのデータが限定提供データに該当するのかを組織内で明確に定義し、適切に管理対象とします。'
                        ]
                      };
                    default:
                      return {
                        definition: `${categoryName}に関する詳細な説明がここに入ります。`,
                        points: []
                      };
                  }
                };

                const categoryInfo = getCategoryDescription(category.category);

                return (
                  <div key={category.category} className="mb-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">{category.category}</h3>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-800 mb-2">定義：</h4>
                          <p className="text-gray-700 text-sm mb-4">
                            {categoryInfo.definition}
                          </p>
                        </div>
                        
                        {categoryInfo.points.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-800 mb-2">重要ポイント：</h4>
                            <ul className="space-y-2 text-sm text-gray-700">
                              {categoryInfo.points.map((point, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-blue-600 mr-2 mt-1">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* サブカテゴリリスト */}
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2">評価項目:</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                            {category.subcategories.map((subcategory) => (
                              <li key={subcategory.name}>{subcategory.name}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 成熟度のレベル定義 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <button
            onClick={() => setShowMaturityLevels(!showMaturityLevels)}
            className="w-full flex items-center justify-between mb-6"
          >
            <h2 className="text-2xl font-bold">成熟度のレベル定義</h2>
            <svg
              className={`w-6 h-6 transition-transform ${
                showMaturityLevels ? 'transform rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showMaturityLevels && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-800 whitespace-nowrap" style={{width: '80px'}}>
                      レベル
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-800 whitespace-nowrap" style={{width: '120px'}}>
                      名称
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-800">
                      組織の状態概要
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      1
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      無防備
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                      対策が場当たり的で、ルールやプロセスが存在しない状態。個人の努力や暗黙知に依存しており、組織的な管理は行われていない。リスクの認識も限定的。
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      2
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      部分防御
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                      一部の部門や担当者によって個別の対策が実施されているが、全社で一貫しておらず、サイロ化している状態。ルールは存在するが、非公式であったり形骸化している。
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      3
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      組織的防御
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                      全社的な方針やルールが文書化され、関係者に周知されている状態。対策プロセスが定義され、一貫性のある対応が可能になっているが、その効果測定は限定的。
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      4
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      動的防御
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                      標準化されたプロセスが定着し、対策の実施状況や効果がデータに基づいて定量的に測定・評価されている状態。リスク評価に基づき、継続的な改善活動が行われている。
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      5
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      予測的防御
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                      データ保護が組織文化として定着し、事業戦略の一部として位置づけられている状態。自動化技術などを活用して継続的な改善が自律的に行われ、脅威に対しプロアクティブに対応できる。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 中項目別総評コメント */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">中項目別 総評コメント（AIによる評価・推奨事項提案）</h2>
          
          {surveyData.map((category) => (
            <div key={category.category} className="mb-8">
              <h3 className="text-xl font-bold text-slate-800 mb-4">{category.category}</h3>
              
              {category.subcategories.map((subcategory) => {
                const subcatData = subcategoryData.find(
                  s => s.category === category.category && s.subcategory === subcategory.name
                );
                
                // AI評価結果を取得（中項目番号でマッチング）
                const subcategoryId = subcategory.items[0]?.chuItemNumber;
                const aiEvaluation = subcategoryId ? aiEvaluations[subcategoryId] : null;
                
                return (
                  <div key={subcategory.name} className={`mb-4 p-4 rounded-lg ${
                    parseFloat(subcatData?.averageScore) >= 4 ? 'bg-green-50' : 
                    parseFloat(subcatData?.averageScore) >= 2 ? 'bg-yellow-50' : 
                    subcatData?.hasAnswers ? 'bg-red-50' : 'bg-gray-50'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-lg font-semibold text-slate-700">{subcategory.name}</h4>
                      <span className={`font-bold text-lg ${
                        parseFloat(subcatData?.averageScore) >= 4 ? 'text-green-600' : 
                        parseFloat(subcatData?.averageScore) >= 2 ? 'text-yellow-600' : 
                        subcatData?.hasAnswers ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {subcatData?.hasAnswers ? subcatData.averageScore : '-'}
                      </span>
                    </div>
                    
                    {/* AI評価結果を優先表示 */}
                    {aiEvaluation && aiEvaluation.recommendationText ? (
                      <div className="mb-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-md">
                        {aiEvaluation.evaluationText && (
                          <div className="text-blue-700 text-sm mb-2">
                            <strong>評価:</strong> 
                            <span dangerouslySetInnerHTML={{ __html: aiEvaluation.evaluationText }} />
                          </div>
                        )}
                        <div className="text-blue-700 text-sm">
                          <strong>推奨事項:</strong>
                          {/* dangerouslySetInnerHTMLを使用してHTMLをレンダリング */}
                          <span dangerouslySetInnerHTML={{ __html: aiEvaluation.recommendationText }} />
                      </div>
                      </div>
                    ) : null}
                    
                    {subcatData?.hasAnswers ? (
                      subcatData.comments.length > 0 ? (
                        <div className="space-y-2">
                          <h5 className="font-medium text-slate-600 text-sm">個別コメント:</h5>
                          {subcatData.comments.map((comment, index) => (
                            <div key={index} className="text-sm">
                              <p className="font-medium text-slate-600">{comment.question}</p>
                              <p className="text-slate-700 ml-2">{comment.comment}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        // AI評価がない場合のみデフォルトコメントを表示
                        !aiEvaluation && (
                          <p className="text-slate-600 text-sm">
                            {parseFloat(subcatData.averageScore) >= 4 
                              ? '非常によく管理されています。現在の高い水準を維持してください。'
                              : parseFloat(subcatData.averageScore) >= 2
                              ? '改善の余地があります。具体的な対策を検討してください。'
                              : '早急な対応が必要です。リスクを最小限に抑えるため、速やかに改善策を実施してください。'
                            }
                          </p>
                        )
                      )
                    ) : (
                      <p className="text-slate-500 text-sm">この項目は評価されていません。</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 詳細評価シート */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" style={{breakInside: 'avoid'}}>
          <h2 className="text-2xl font-bold mb-6">詳細評価シート</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" style={{tableLayout: 'fixed', width: '100%'}}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '35%'}}>
                    項目
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '6ch'}}>
                    評価点
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '15%'}}>
                    コメント
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '20%'}}>
                    リスク
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '20%'}}>
                    関連法規
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detailData.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{breakInside: 'avoid'}}>
                    <td className="px-4 py-3 text-sm text-gray-900" style={{wordWrap: 'break-word', maxWidth: '200px'}}>
                      {item.question}
                    </td>
                    <td className="px-4 py-3 text-center" style={{width: '6ch'}}>
                      {item.score === '未評価' ? (
                        // 未評価はバッジを表示しない（空にする）
                        null
                      ) : (
                        <div className={`inline-block w-8 h-8 rounded-full text-xs font-medium leading-8 text-center ${
                          parseInt(item.score) >= 4 ? 'bg-green-100 text-green-800' :
                          parseInt(item.score) >= 2 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.score}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900" style={{wordWrap: 'break-word', maxWidth: '150px'}}>
                      {item.comment}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900" style={{wordWrap: 'break-word', maxWidth: '150px'}}>
                      {item.risk}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900" style={{wordWrap: 'break-word', maxWidth: '100px'}}>
                      {item.relatedLaw}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ダウンロードボタン */}
        <div className="text-center mt-8">
          <button
            onClick={handleDownloadClick}
            disabled={isDownloaded}
            className={`download-btn inline-flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              isDownloaded 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isDownloaded ? 'ダウンロード済み' : 'ダウンロード'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
