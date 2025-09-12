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
      const filename = `${companyName}様_AI時代の内部情報漏洩対策アセスメント結果.pdf`;
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
            const maxLen = 14;
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
          
          <div className="flex flex-col lg:flex-row items-center justify- gap-8">
            {/* レーダーチャート */}
            <div className="w-full max-w-md h-96">
              <Radar 
                data={radarData} 
                options={radarOptions} 
              />
            </div>

            {/* 総合評価結果 */}
            <div className="w-full lg:w-96">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-bold text-center mb-4">総合評価</h3>
                
                {/* 点数表示 */}
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {(Object.values(categoryScores).reduce((sum, score) => sum + Number(score), 0) / Object.values(categoryScores).length).toFixed(1)} / 5.0
                  </div>
                  <div className="text-lg font-semibold text-gray-700">
                    レベル4：定量的管理
                  </div>
                </div>

                {/* 薄青枠：総合評価文 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700">
                    管理されたプロセスが定着し、安定した成果創出が期待できます。さらに組織文化として根付かせ、自律的な改善サイクルを目指しましょう。
                  </p>
                </div>

                {/* 黄色枠：リスク評価文 */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-yellow-400 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-bold text-yellow-800">現状のままの場合に想定される主なリスク</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        プロセスの改善や効率化に留意するあまり、挑戦的なアイデア内になくなり、イノベーションのジレンマに陥る可能性があります。市場環境の変化に対する感度が鈍ることも懸念されます。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
