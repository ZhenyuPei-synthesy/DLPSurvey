import React, { useState, useEffect, useRef } from 'react';
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
  
  // セクションナビゲーション用のref
  const sectionRefs = {
    background: useRef(null),
    creation: useRef(null),
    evaluation: useRef(null),
    benefits: useRef(null),
    start: useRef(null)
  };

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

  // セクションへのスクロール機能
  const scrollToSection = (sectionKey) => {
    const element = sectionRefs[sectionKey]?.current;
    if (element) {
      const headerOffset = 280; // ヘッダー（192px）、タブナビゲーション（60px）、マージン（28px）を考慮
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
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

        {/* 固定タブナビゲーション */}
        <div className="sticky top-48 z-50 bg-white border-b border-gray-200 shadow-sm mb-6 rounded-lg">
          <div className="flex flex-wrap gap-2 p-4">
            <button
              onClick={() => scrollToSection('background')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              背景と目的
            </button>
            <button
              onClick={() => scrollToSection('creation')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              本アセスメントの作成方法について
            </button>
            <button
              onClick={() => scrollToSection('evaluation')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              評価軸について
            </button>
            <button
              onClick={() => scrollToSection('benefits')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              ご協力いただいた企業向け特典
            </button>
            <button
              onClick={() => scrollToSection('start')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              アセスメントを開始するにあたって
            </button>
          </div>
        </div>

        {/* 背景と目的セクション */}
        <div ref={sectionRefs.background} className="bg-white p-8 rounded-lg shadow-sm mb-6">
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

        {/* 本アセスメントの作成方法についてセクション */}
        <div ref={sectionRefs.creation} className="bg-white p-8 rounded-lg shadow-sm mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">本アセスメントの作成方法について</h2>
          
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              客観性と信頼性を担保するため、以下の公的な指針に基づき設計しています。
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">経済産業省「営業秘密管理指針」</span>
                  <p className="text-sm text-gray-600 mt-1">不正競争防止法による保護を受けるために必要となる営業秘密の管理水準を示す指針です。</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">経済産業省「技術情報の保護ハンドブック」</span>
                  <p className="text-sm text-gray-600 mt-1">企業の秘密情報の流出を未然に防ぐことを目的に、具体的な対策例を紹介するハンドブックです。</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">経済産業省「限定提供データに関する指針」</span>
                  <p className="text-sm text-gray-600 mt-1">限定提供データの不正競争に関する考え方や具体例を示す指針です。</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">IPA「組織における内部不正防止ガイドライン」</span>
                  <p className="text-sm text-gray-600 mt-1">情報管理ルールの理解含め、不正を抑制する組織風土作りの考え方を示すガイドラインです。</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">OWASP「OWASP LLMアプリケーションのトップ10」</span>
                  <p className="text-sm text-gray-600 mt-1">生成AIに特有の脅威やリスクを評価し、対策を講じるための考え方を示すフレームワークです。</p>
                </div>
              </div>

            </div>
            
            <p className="mt-4">
              これらの公的指針を統合的に参照し、推奨される対策項目を設問形式に落とし込むことで、AI時代の脅威に対応する網羅的なアセスメントを作成しています。
            </p>
          </div>
        </div>

        {/* 評価軸について */}
        <div ref={sectionRefs.evaluation} className="bg-white p-8 rounded-lg shadow-sm mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">評価軸について</h2>
          
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              本アセスメントでは、AI時代の情報管理において重要となる7つの評価軸で現状を診断します。
            </p>
            
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
          </div>
        </div>

        {/* 特典セクション */}
        <div ref={sectionRefs.benefits} className="bg-white p-8 rounded-lg shadow-sm mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">ご協力いただいた企業向け特典</h2>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">AIによる簡易診断レポート</h4>
                <p className="text-sm text-gray-600">回答後すぐに、現状評価と推奨事項をまとめたレポートをダウンロードいただけます。</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">専門家による詳細な改善提案</h4>
                <p className="text-sm text-gray-600">ご希望の企業様には、弊社のコンサルタントが回答結果を分析し、改善策とロードマップをご提案致します。</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-[#efe6ff] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#2b0066]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">業界ベンチマークレポートのご提供</h4>
                <p className="text-sm text-gray-600">ベンチマークレポートの統計利用にご協力いただける企業様には、3ヶ月後に業界ベンチマークレポートを無償でご提供致します。</p>
              </div>
            </div>
          </div>
        </div>

        {/* アセスメント開始セクション */}
        <div ref={sectionRefs.start} className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b-2 border-[#5629AA] pb-2">アセスメントを開始するにあたって</h2>
            <div className="text-gray-700 mb-6">
              <p className="mb-4">
                本アセスメントは、貴社の組織全体の状況を正確に把握するのを目的としているため、必要に応じて貴社のIT・人事・法務部門等のご協力を想定しています。
              </p>

              <ul className="list-disc list-inside mb-4 pl-4">
                <li><strong>設問数</strong>：{totalQuestions > 0 ? `${totalQuestions}問` : '計算中...'}</li>
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
                  をご確認の上、次へお進みください
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