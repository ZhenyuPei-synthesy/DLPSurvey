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
  const [resumeInputs, setResumeInputs] = useState({ answerNumber: '' });
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
    console.log('handleSubmit called'); // デバッグログ
    console.log('handleSubmit called'); // デバッグログ
    setIsSubmitting(true);
    setError(null);

    // 免責事項の同意確認のみ
    // 免責事項の同意確認のみ
    const errors = {};
    if (!agreedToTerms) errors.terms = '免責事項とプライバシーポリシーへの同意が必要です。';

    if (Object.keys(errors).length > 0) {
      console.log('Validation errors:', errors); // デバッグログ
      console.log('Validation errors:', errors); // デバッグログ
      setFieldErrors(errors);
      setIsSubmitting(false);
      return;
    }

    // apiUrl will always be defined now (fallback to same-origin), but still validate
    if (!apiUrl) {
      console.log('API URL not configured'); // デバッグログ
      console.log('API URL not configured'); // デバッグログ
      setError('送信先APIが設定されていません。環境変数を確認してください。');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('Making API request to:', apiUrl); // デバッグログ
      // 空のオブジェクトを送信（APIで回答者番号ベースの値を自動設定）
      console.log('Making API request to:', apiUrl); // デバッグログ
      // 空のオブジェクトを送信（APIで回答者番号ベースの値を自動設定）
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 空のオブジェクト - APIで自動値生成
          // 空のオブジェクト - APIで自動値生成
        })
      });

      console.log('API response status:', res.status); // デバッグログ

      console.log('API response status:', res.status); // デバッグログ

      if (!res.ok) {
        const text = await res.text();
        console.log('API error response:', text); // デバッグログ
        console.log('API error response:', text); // デバッグログ
        throw new Error(`APIエラー: ${res.status} ${text}`);
      }

      const json = await res.json();
      console.log('API response data:', json); // デバッグログ
      
      console.log('API response data:', json); // デバッグログ
      
      const respondentId = json.respondentId || json.id || null;
      const answerNumber = json.answerNumber || null;
      
      // セッションストレージに回答者番号を保存
      if (respondentId) {
        sessionStorage.setItem('respondentId', respondentId.toString());
        // 回答者番号ベースの値を保存
        sessionStorage.setItem('companyName', respondentId.toString());
        sessionStorage.setItem('respondentEmail', `${respondentId}@.tmp.co.jp`);
        console.log('Stored respondentId:', respondentId); // デバッグログ
        // 回答者番号ベースの値を保存
        sessionStorage.setItem('companyName', respondentId.toString());
        sessionStorage.setItem('respondentEmail', `${respondentId}@.tmp.co.jp`);
        console.log('Stored respondentId:', respondentId); // デバッグログ
      }
      if (answerNumber) {
        sessionStorage.setItem('answerNumber', answerNumber.toString());
        console.log('Stored answerNumber:', answerNumber); // デバッグログ
        console.log('Stored answerNumber:', answerNumber); // デバッグログ
      }
      
      console.log('Calling onNext with respondentId:', respondentId); // デバッグログ
      console.log('Calling onNext with respondentId:', respondentId); // デバッグログ
      onNext(respondentId);
    } catch (err) {
      console.error('Submit error:', err);
      console.error('Submit error:', err);
      setError(err.message || '送信中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeSubmit = async (e) => {
    e.preventDefault();
    setIsResuming(true);
    setResumeError(null);

    if (!resumeInputs.answerNumber) {
      setResumeError('アセスメント番号を入力してください。');
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
        // レスポンスからメールアドレスを取得して設定
        if (json.respondentEmail) {
          sessionStorage.setItem('respondentEmail', json.respondentEmail);
        }

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
    <div className="h-full font-sans bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        
        {/* 背景と目的セクション */}
        <div className="bg-white p-8 rounded-lg shadow-sm mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">背景と目的</h2>
          
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              データ保護は、企業の競争力や社会的信用を維持する上で不可欠な経営課題です。特に生成AIの普及は、意図しない形での情報漏洩という、これまで想定されなかった新たな脅威を生んでいます。
            </p>
            <p>
              本アセスメントは、AI時代における貴社の情報管理体制の現状を正確に把握することを目的としています。客観的な評価を通じて課題を可視化し、AIを安全に活用できるセキュリティ体制の構築を支援します。
            </p>
          </div>
        </div>

        {/* 利用方法セクション */}
        <div className="bg-white p-8 rounded-lg shadow-sm mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">本アセスメントの利用方法について</h2>
          
          <p className="text-gray-700 mb-4">
            客観性と信頼性を担保するため、以下のステップで質問項目が構成されています。
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">現状把握（経営層/管理職向け）</h4>
                <p className="text-sm text-gray-600">不正行為防止に必要な体制がとられているかを診断する質問項目です。</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">経営陣営（組織情報管理の高いリテラシー）</h4>
                <p className="text-sm text-gray-600">活用名称提出に組織全体に求められる安全な活用の対策が共有されているかを確認する項目です。</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">AI活用における情報不正防止対策</h4>
                <p className="text-sm text-gray-600">情報セキュリティ対策に関する方針を明確にする質問項目です。</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">今後のChatGPT活用に必要なアセスメント</h4>
                <p className="text-sm text-gray-600">AI活用に伴う情報セキュリティリスクの対策項目についてのチェックリストです。</p>
              </div>
            </div>
          </div>
        </div>

        {/* 特典セクション */}
        <div className="bg-white p-8 rounded-lg shadow-sm mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">ご協力いただきたい企業内の方々</h2>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">AIおよび情報活用レポート</h4>
                <p className="text-sm text-gray-600">回答を基準し、部門の活動状況を破綻した上でレポート作成にご協力いただけます。</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">専門家による詳細な改善研修</h4>
                <p className="text-sm text-gray-600">ご希望の必要領域に、専門家がお答えを研修し、安全性についてより深く振り下げします。</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">選択ベンダーサポートへのご質問</h4>
                <p className="text-sm text-gray-600">ベンダーパートナーからの追加印刷が必要な場合には、経費からご連絡・協力します。</p>
              </div>
            </div>
          </div>
        </div>

        {/* アセスメント開始セクション */}
        <div className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">アセスメントを開始するにあたって</h2>
            <div className="text-gray-700 mb-6">
              <p className="mb-4">
                本アセスメントは、貴社の組織全体の状況を正確に把握するのを目的としているため、必要に応じて貴社のIT・人事・法務部門等のご協力を想定しています。
              </p>

              <ul className="list-disc list-inside mb-4 pl-4">
                <li><strong>設問数</strong>：85問</li>
                <li><strong>所要時間の目安</strong>：20～30分</li>
              </ul>

              <p>
                <strong>▼回答を中断する場合</strong><br />
                回答を途中で中断される場合は、お手数ですが画面の<strong>「一時保存」ボタン</strong>をご利用ください。後ほど同じ状態から再開できます。なお、セキュリティ保護のため、<strong>15分以上画面操作がないと自動的一時保存</strong>されます。<br />
              </p>
            </div>
          <form onSubmit={handleSubmit}>
            {/* 入力フォームを非表示 */}
            <div className="space-y-3" style={{display: 'none'}}>
              <div>
                <label className="block text-sm text-slate-600">会社名 <span className="text-red-600">*</span></label>
                <input name="company" aria-required="true" value={form.company} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
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
                <input name="name" aria-required="true" value={form.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
                {fieldErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600">メールアドレス <span className="text-red-600">*</span></label>
                <input type="email" name="email" aria-required="true" value={form.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
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
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                <span className="text-sm text-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-blue-600 underline hover:text-blue-800 font-medium"
                  >
                    免責事項
                  </button>
                  をご確認の上、アセスメント開始へお進めてください。
                   <span className="text-red-600 ml-1">*</span>
                </span>
              </label>
              {fieldErrors.terms && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.terms}</p>
              )}
            </div>

            {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}

            {/* アクションボタン */}
            <div className="flex flex-col items-center space-y-4">
              <button 
                type="submit" 
                disabled={isSubmitting || !agreedToTerms} 
                className={`w-full max-w-md px-8 py-3 rounded-full text-white font-medium text-lg transition-all duration-200 ${
                  isSubmitting || !agreedToTerms 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#8D66B9] hover:bg-[#7A5BA5] hover:shadow-lg transform hover:scale-105'
                }`}
              >
                {isSubmitting ? '処理中...' : 'アセスメント開始'}
              </button>

              <button 
                type="button"
                onClick={handleResumeToggle} 
                className="w-full max-w-md px-8 py-3 rounded-full border-2 border-gray-300 text-gray-700 font-medium text-lg hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                アセスメント再開
              </button>
            </div>
          </form>

          {showResumeForm && (
            <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">アセスメント再開</h3>
              <p className="text-sm text-gray-600 mb-4">保存したアセスメント番号を入力してアセスメントを再開できます。</p>
              <form onSubmit={handleResumeSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">アセスメント番号</label>
                    <input 
                      name="answerNumber" 
                      value={resumeInputs.answerNumber} 
                      onChange={handleResumeInputChange} 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      required 
                    />
                  </div>
                  {resumeError && (
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{resumeError}</p>
                  )}
                  <div className="text-center">
                    <button 
                      type="submit" 
                      disabled={isResuming}
                      className="px-6 py-2 bg-[#8D66B9] text-white rounded-lg font-medium hover:bg-[#7A5BA5] disabled:bg-gray-400 transition-colors"
                    >
                      {isResuming ? '再開中...' : '再開'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}       
        </div>
      </div>

      {/* フッターセクション */}
      <footer className="bg-slate-100 border-t border-gray-200 py-8 mt-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="mb-4">
            <a
              href="https://synthesy.co.jp/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 transition-colors font-medium"
            >
              個人情報取り扱い及び保護方針
            </a>
          </div>
          
          <div className="text-slate-600 space-y-1 mb-4 text-sm">
            <p className="font-medium text-slate-800">Synthesy（シンセシー）株式会社</p>
            <p>Tel：050-1707-2227</p>
            <p>本社：〒103-0027 東京都中央区日本橋2-1-3 アーバンネット日本橋二丁目ビル 6階</p>
          </div>
          
          <div className="text-slate-500 text-xs">
            <p>©2025. SYNTHESY All Rights Reserved.</p>
          </div>
        </div>
      </footer>

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
                    免責事項
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
                    <h5 className="font-medium text-gray-800 mb-1">AI評価の正確性について:</h5>
                    <p className="mb-3">
                      本ツールが提供するAIによる評価スコアおよびコメントは、入力された情報に基づき自動生成されたものです。評価の精度向上には努めておりますが、その正確性、完全性、有用性を保証するものではありません。
                    </p>

                    <h5 className="font-medium text-gray-800 mb-1">参考情報としての位置づけ:</h5>
                    <p className="mb-3">
                      AIによる評価結果は、貴社の情報漏洩対策の現状を把握するための一助となる参考情報です。本評価のみに基づいた最終的な意思決定や対策の実施については、お客様ご自身の責任で行っていただくとともに、必要に応じて専門家へご相談ください。
                    </p>
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
