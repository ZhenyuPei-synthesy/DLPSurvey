import React, { useState, useEffect } from 'react';
import { parseExcelDataToJson } from './parser.js';

const Welcome = ({ onNext }) => {
  const [form, setForm] = useState({
    company: '',
    department: '',
    jobTitle: '',
    name: '',
    email: '',
    phone: '',
    expertConsultation: '', // 専門家による改善提案の希望可否
    statisticsCooperation: '' // 統計利用協力の可否
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // per-field validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  const [showResumeForm, setShowResumeForm] = useState(false);
  const [resumeInputs, setResumeInputs] = useState({ email: '', answerNumber: '' });
  const [resumeError, setResumeError] = useState(null);
  const [isResuming, setIsResuming] = useState(false);
  // 免責事項とプライバシーポリシー関連
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  // 質問データと総問数
  const [surveyData, setSurveyData] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // In development prefer relative path so Vite proxy forwards to local Functions.
  // In production use the explicit environment variable if provided.
  const isDev = import.meta.env.MODE === 'development';
  const apiUrl = isDev
    ? '/api/CreateRespondent'
    : (import.meta.env.VITE_CREATE_RESPONDENT_API_URL || '/api/CreateRespondent');

  // 質問データを取得して総問数を計算
  useEffect(() => {
    const fetchQuestionCount = async () => {
      try {
        const surveyApiUrl = import.meta.env.VITE_APP_GET_SURVEY_API_URL;
        if (!surveyApiUrl) return;

        const response = await fetch(surveyApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'DLP-Survey-App/1.0'
          },
          mode: 'cors',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          const data = await response.json();
          const structuredData = parseExcelDataToJson(data);
          setSurveyData(structuredData);
          
          // 総問数を計算
          let questionCount = 0;
          structuredData.forEach(category => {
            category.subcategories.forEach(subcategory => {
              questionCount += subcategory.items.length;
            });
          });
          setTotalQuestions(questionCount);
        }
      } catch (err) {
        console.error("質問データの取得に失敗:", err);
      }
    };

    fetchQuestionCount();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // clear validation error for this field when user edits it
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // client-side validation for required fields
    const errors = {};
    if (!form.company || form.company.trim() === '') errors.company = '企業名は必須です。';
    if (!form.name || form.name.trim() === '') errors.name = '氏名は必須です。';
    if (!form.email || form.email.trim() === '') {
      errors.email = 'メールアドレスは必須です。';
    } else {
      const emailRe = /^\S+@\S+\.\S+$/;
      if (!emailRe.test(form.email)) errors.email = '正しいメールアドレスを入力してください。';
    }
    if (!agreedToTerms) errors.terms = '免責事項とプライバシーポリシーへの同意が必要です。';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsSubmitting(false);
      return;
    }

    // apiUrl will always be defined now (fallback to same-origin), but still validate
    if (!apiUrl) {
      setError('送信先APIが設定されていません。環境変数を確認してください。');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company,
          department: form.department,
          jobTitle: form.jobTitle,
          name: form.name,
          email: form.email,
          phone: form.phone
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`APIエラー: ${res.status} ${text}`);
      }

      const json = await res.json();
      const respondentId = json.respondentId || json.id || null;
      const answerNumber = json.answerNumber || null;
      
      // セッションストレージに回答者番号を保存
      if (respondentId) {
        sessionStorage.setItem('respondentId', respondentId.toString());
      }
      // store companyName, answerNumber and email for resume/report
      if (form.company) {
        sessionStorage.setItem('companyName', form.company);
      }
      if (answerNumber) {
        sessionStorage.setItem('answerNumber', answerNumber.toString());
      }
      if (form.email) {
        sessionStorage.setItem('respondentEmail', form.email);
      }
      
      onNext(respondentId);
    } catch (err) {
      console.error(err);
      setError(err.message || '送信中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeSubmit = async (e) => {
    e.preventDefault();
    setIsResuming(true);
    setResumeError(null);

    if (!resumeInputs.email || !resumeInputs.answerNumber) {
      setResumeError('メールアドレスとアセスメント番号を入力してください。');
      setIsResuming(false);
      return;
    }

    const resumeApiUrl = isDev
      ? '/api/ResumeSurvey'
      : (import.meta.env.VITE_RESUME_SURVEY_API_URL || '/api/ResumeSurvey');

    try {
      const res = await fetch(resumeApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resumeInputs.email,
          answerNumber: resumeInputs.answerNumber
        })
      });

        // parse response safely: prefer JSON, but fall back to text when not JSON
        let json;
        if (!res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'アセスメントの再開に失敗しました');
          } else {
            const txt = await res.text();
            throw new Error(txt || `APIエラー: ${res.status}`);
          }
        }

        // OK response: try parse JSON, else throw
        try {
          json = await res.json();
        } catch (e) {
          const txt = await res.text();
          throw new Error(txt || 'レスポンスの解析に失敗しました');
        }
      
      // 回答済みの場合は専用メッセージを表示
      if (json.completed) {
        setResumeError(json.error || 'このアセスメントは既に回答が完了しています。');
        setIsResuming(false);
        return;
      }
      
      const respondentId = json.respondentId;
      
      if (respondentId) {
        // セッションストレージにデータを設定
        sessionStorage.setItem('respondentId', respondentId.toString());
        sessionStorage.setItem('answerNumber', resumeInputs.answerNumber);
        sessionStorage.setItem('respondentEmail', resumeInputs.email);

        // アセスメントを再開
        onNext(respondentId);
      } else {
        throw new Error('回答者IDが取得できませんでした');
      }
    } catch (err) {
      console.error(err);
      setResumeError(err.message || 'アンケートの再開中にエラーが発生しました');
    } finally {
      setIsResuming(false);
    }
  };

  const handleResumeToggle = () => setShowResumeForm(prev => !prev);

  const handleResumeInputChange = (e) => {
    const { name, value } = e.target;
    setResumeInputs(prev => ({ ...prev, [name]: value }));
  };

  async function domainHasMX(domain) {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const json = await res.json();
    return Array.isArray(json.Answer) && json.Answer.some(a => a.type === 15); // 15 == MX
  }

  return (
    <div className="h-full font-sans">

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">背景と目的</h2>
          <p className="text-slate-600 mb-4">
            データ保護は、企業の競争力や社会的信用を維持する上で不可欠な経営課題です。特に生成AIの普及は、意図しない形での情報漏洩という、これまで想定されなかった新たな脅威を生んでいます。
          </p>

          <p className="text-slate-600 mb-4">
            本アセスメントは、AI時代における貴社の情報管理体制の現状を正確に把握することを目的としています。客観的な評価を通じて課題を可視化し、AIを安全に活用できるセキュリティ体制の構築を支援します。
          </p>

          <p className="text-slate-600 mb-4">
            組織全体の状況を正確に把握するため、貴社のIT・人事・法務部門等のご協力を想定しています。
          </p>

          <h3 className="text-lg font-medium mb-3">本アセスメントの作成方法について</h3>
          <p className="text-slate-600 mb-3">
            客観性と信頼性を担保するため、以下の公的な指針に基づき設計しています。
          </p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-2">
            <li>
              <strong>経済産業省「営業秘密管理指針」</strong>
              <div className="text-sm text-slate-500">不正競争防止法による保護を受けるために必要となる最低限の水準の対策を示すものです。</div>
            </li>
            <li>
              <strong>経済産業省「技術情報の保護ハンドブック」</strong>
              <div className="text-sm text-slate-500">秘密情報の漏えいを未然に防ぎたいと考える企業の方々が対策を行う際に参考としていただけるよう、様々な対策例を紹介するハンドブックです。</div>
            </li>
            <li>
              <strong>IPA「組織における内部不正防止ガイドライン」</strong>
              <div className="text-sm text-slate-500">情報管理ルールの理解度や、不正を抑制する組織風土を把握します。</div>
            </li>
            <li>
              <strong>OWASP「OWASPの生成AIセキュリティプロジェクト」</strong>
              <div className="text-sm text-slate-500">生成AIに特有の脅威やリスクを評価し、対策を講じるためのフレームワークを提供します。</div>
            </li>
          </ul>

          <p className="text-slate-600 mb-4">
            これらの公的指針を横断的に参照し、推奨される対策項目を設問形式に落とし込むことで、AI時代の脅威に対応する網羅的なアセスメントを作成しています。
          </p>

          <h3 className="text-lg font-medium mb-3">ご協力いただいた企業様への特典</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>
              <strong>AIによる簡易診断レポート</strong>
              <div className="text-sm text-slate-500">回答後すぐに、現状の強みと課題をまとめたレポートをダウンロードいただけます。</div>
            </li>
            <li>
              <strong>専門家による詳細な改善提案</strong>
              <div className="text-sm text-slate-500">ご希望の企業様には、専門家が結果を分析し、改善策とロードマップをご提案します。</div>
              <div className="mt-2 ml-4 space-y-1">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="expertConsultation"
                    value="希望する"
                    checked={form.expertConsultation === '希望する'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-slate-600">希望する</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="expertConsultation"
                    value="希望しない"
                    checked={form.expertConsultation === '希望しない'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-slate-600">希望しない</span>
                </label>
              </div>
            </li>
            <li>
              <strong>業界ベンチマークレポートのご提供</strong>
              <div className="text-sm text-slate-500">ベンチマークレポートの統計利用にご協力いただける企業様には、3ヶ月後に業界ベンチマークレポートを無償でご提供します。</div>
              <div className="mt-2 ml-4 space-y-1">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="statisticsCooperation"
                    value="協力する"
                    checked={form.statisticsCooperation === '協力する'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-slate-600">協力する</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="statisticsCooperation"
                    value="協力しない"
                    checked={form.statisticsCooperation === '協力しない'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-slate-600">協力しない</span>
                </label>
              </div>
            </li>
          </ul>
        </div>

  <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium mb-4">回答者情報</h3>
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600">会社名 <span className="text-red-600">*</span></label>
                <input name="company" aria-required="true" required value={form.company} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
                {fieldErrors.company && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.company}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600">部署名</label>
                <input name="department" value={form.department} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">役職</label>
                <input name="jobTitle" value={form.jobTitle} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">氏名 <span className="text-red-600">*</span></label>
                <input name="name" aria-required="true" required value={form.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
                {fieldErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600">メールアドレス <span className="text-red-600">*</span></label>
                <input type="email" name="email" aria-required="true" required value={form.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
                {fieldErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600">電話番号</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
              </div>
            </div>

            {/* 免責事項・プライバシーポリシーの同意 */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    if (e.target.checked) {
                      setFieldErrors(prev => ({ ...prev, terms: undefined }));
                    }
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-slate-600">
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    免責事項とプライバシーポリシー
                  </button>
                  に同意します <span className="text-red-600">*</span>
                </span>
              </label>
              {fieldErrors.terms && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.terms}</p>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 text-right">
              <button 
                type="submit" 
                disabled={isSubmitting || !agreedToTerms} 
                className={`px-6 py-2 rounded ${
                  isSubmitting || !agreedToTerms 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {isSubmitting ? '送信中...' : '次へ'}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t pt-4">
            <button onClick={handleResumeToggle} className="text-sm text-blue-600 underline">アセスメント再開</button>
            {showResumeForm && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">保存したメールアドレスとアセスメント番号を入力してアセスメントを再開できます。</p>
                <form onSubmit={handleResumeSubmit}>
                  <div>
                    <label className="block text-sm text-slate-600">メールアドレス</label>
                    <input 
                      type="email" 
                      name="email" 
                      value={resumeInputs.email} 
                      onChange={handleResumeInputChange} 
                      className="mt-1 w-full p-2 border rounded" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600">アセスメント番号</label>
                    <input 
                      name="answerNumber" 
                      value={resumeInputs.answerNumber} 
                      onChange={handleResumeInputChange} 
                      className="mt-1 w-full p-2 border rounded" 
                      required 
                    />
                  </div>
                  {resumeError && (
                    <p className="mt-2 text-sm text-red-600">{resumeError}</p>
                  )}
                  <div className="text-right mt-3">
                    <button 
                      type="submit" 
                      disabled={isResuming}
                      className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
                    >
                      {isResuming ? '再開中...' : '再開'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-slate-600 text-sm">
                設問は全部で{totalQuestions > 0 ? totalQuestions : 'xx'}問、想定所要時間は20～30分です。<br />
                もし途中で回答を中断される場合は、画面の「一時保存」ボタンを押してください。後ほど同じ状態から再開することが可能です。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 免責事項・プライバシーポリシー モーダル */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* 背景オーバーレイ */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowTermsModal(false)}
            ></div>

            {/* センタリング用のダミー要素 */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* モーダルパネル */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    免責事項とプライバシーポリシー
                  </h3>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => setShowTermsModal(false)}
                  >
                    <span className="sr-only">閉じる</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="max-h-96 overflow-y-auto text-sm text-gray-700 space-y-4">
                  <p>
                    この度は、「AI時代の内部情報漏洩対策アセスメント」をご利用いただき、誠にありがとうございます。本ツールのご利用にあたり、以下の内容についてご確認・ご同意の上、お進みください。
                  </p>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">第1条：免責事項（ディスクレイマー）</h4>
                    
                    <h5 className="font-medium text-gray-800 mb-1">AI評価の正確性について:</h5>
                    <p className="mb-3">
                      本ツールが提供するAIによる評価スコアおよびコメントは、入力された情報に基づき自動生成されたものです。評価の精度向上には努めておりますが、その正確性、完全性、有用性を保証するものではありません。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">参考情報としての位置づけ:</h5>
                    <p className="mb-3">
                      AIによる評価結果は、貴社の情報漏洩対策の現状を把握するための一助となる参考情報です。本評価のみに基づいた最終的な意思決定や対策の実施については、お客様ご自身の責任で行っていただくとともに、必要に応じて専門家へご相談ください。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">損害の責任:</h5>
                    <p className="mb-3">
                      本ツールの利用によって生じたいかなる損害についても、当方は一切の責任を負いかねますので、あらかじめご了承ください。
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">第2条：プライバシーポリシー</h4>
                    <p className="mb-3">
                      当方は、お客様の個人情報の重要性を認識し、その保護の徹底を図るため、以下の通りプライバシーポリシーを定めます。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">個人情報の定義:</h5>
                    <p className="mb-3">
                      本ポリシーにおいて「個人情報」とは、氏名、所属組織名、連絡先（メールアドレス、電話番号）など、特定の個人を識別できる情報を指します。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">個人情報の取得と利用目的:</h5>
                    <p className="mb-2">本アセスメントでは、以下の目的でお客様の個人情報をご入力いただきます。</p>
                    <ul className="list-disc list-inside mb-3 ml-4 space-y-1">
                      <li>アセスメント結果の報告および送付のため</li>
                      <li>本人確認のため</li>
                      <li>本アセスメントに関するお問い合わせへの対応のため</li>
                      <li>当社サービスに関するご案内や情報提供のため</li>
                    </ul>
                    <p className="mb-3">
                      ご入力いただいた個人情報は、AIによる評価・分析プロセスには一切使用されません。AI評価は、アセスメントの設問に対する回答内容のみを用いて行われます。また、取得した個人情報は、上記利用目的の範囲を超えて利用することはありません。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">個人情報の第三者への提供:</h5>
                    <p className="mb-3">
                      当方は、法令に基づく場合や、人の生命、身体または財産の保護のために必要がある場合を除き、お客様の同意を得ずに個人情報を第三者に開示または提供することはありません。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">安全管理措置:</h5>
                    <p className="mb-3">
                      当方は、取り扱う個人情報の漏洩、滅失または毀損の防止、その他の個人情報の安全管理のために、必要かつ適切な措置を講じます。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">プライバシーポリシーの変更:</h5>
                    <p className="mb-3">
                      当方は、法令の改正やサービス内容の変更等に応じて、本プライバシーポリシーを改定することがあります。重要な変更がある場合には、本ツール上でお知らせいたします。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">お問い合わせ窓口:</h5>
                    <p className="mb-3">
                      個人情報の取り扱いに関するご質問やご相談については、下記までお問い合わせください。
                    </p>
                    <p className="mb-1">お問い合わせ先窓口：Synthesy株式会社 情報漏洩対策サービスチーム</p>
                    <p>メールアドレス：〇〇〇@synthesy.co.jp</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setAgreedToTerms(true);
                    setShowTermsModal(false);
                    setFieldErrors(prev => ({ ...prev, terms: undefined }));
                  }}
                >
                  同意する
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowTermsModal(false)}
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Welcome;
