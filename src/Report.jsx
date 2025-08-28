import React from 'react';
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
  // PDFダウンロード機能
  const downloadPDF = async () => {
    try {
      // 企業名を取得（sessionStorageから）
      const companyName = sessionStorage.getItem('companyName') || '企業名未設定';
      
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
      
      categoryScores[category.category] = itemCount > 0 ? (totalScore / itemCount).toFixed(2) : 0;
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
            relatedRegulations: item.relatedRegulations || '-'
          });
        });
      });
    });
    
    return detailData;
  };

  const categoryScores = calculateCategoryScores();
  const subcategoryData = getSubcategoryComments();
  const detailData = getDetailedEvaluationData();

  // レーダーチャートのデータ
  const radarData = {
    labels: Object.keys(categoryScores),
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
    ],
  };

  const radarOptions = {
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
      },
    },
  };

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
      <div className="max-w-6xl mx-auto">
        {/* PDFダウンロードボタン */}
        <div className="text-center mb-6">
          <button
            onClick={downloadPDF}
            className="download-btn inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ダウンロード
          </button>
        </div>

        <div id="report-content">

        {/* レーダーチャートセクション */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">評価結果レポート</h2>
          
          <div className="flex justify-center mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 mr-2"></div>
              <span className="text-sm text-slate-600">平均スコア</span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
            {/* レーダーチャート */}
            <div className="w-full max-w-md h-96">
              <Radar data={radarData} options={radarOptions} />
            </div>

            {/* 大項目別平均スコア */}
            <div className="w-full lg:w-80">
              <h3 className="text-xl font-bold mb-4">大項目別 平均スコア</h3>
              <div className="space-y-3">
                {Object.entries(categoryScores).map(([category, score]) => (
                  <div key={category} className="flex justify-between items-center">
                    <span className="text-slate-700">{category}</span>
                    <span className={`font-bold text-lg ${
                      parseFloat(score) >= 4 ? 'text-green-600' : 
                      parseFloat(score) >= 2 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 中項目別総評コメント */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">中項目別 総評コメント</h2>
          
          {surveyData.map((category) => (
            <div key={category.category} className="mb-8">
              <h3 className="text-xl font-bold text-slate-800 mb-4">{category.category}</h3>
              
              {category.subcategories.map((subcategory) => {
                const subcatData = subcategoryData.find(
                  s => s.category === category.category && s.subcategory === subcategory.name
                );
                
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
                    
                    {subcatData?.hasAnswers ? (
                      subcatData.comments.length > 0 ? (
                        <div className="space-y-2">
                          {subcatData.comments.map((comment, index) => (
                            <div key={index} className="text-sm">
                              <p className="font-medium text-slate-600">{comment.question}</p>
                              <p className="text-slate-700 ml-2">{comment.comment}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-600 text-sm">
                          {parseFloat(subcatData.averageScore) >= 4 
                            ? '非常によく管理されています。現在の高い水準を維持してください。'
                            : parseFloat(subcatData.averageScore) >= 2
                            ? '改善の余地があります。具体的な対策を検討してください。'
                            : '早急な対応が必要です。リスクを最小限に抑えるため、速やかに改善策を実施してください。'
                          }
                        </p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '20%'}}>
                    コメント
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '20%'}}>
                    リスク
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '15%'}}>
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
                      {item.relatedRegulations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="text-center mt-8">
          <button
            onClick={downloadPDF}
            className="download-btn inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ダウンロード
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
