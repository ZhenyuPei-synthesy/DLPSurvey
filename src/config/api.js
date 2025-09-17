const API_ENDPOINTS = {
  DELETE_AI_EVALUATIONS: import.meta.env.MODE === 'development' 
    ? '/api/DeleteAIEvaluations'
    : (import.meta.env.VITE_DELETE_AI_EVALUATIONS_API_URL || '/api/DeleteAIEvaluations')
};

export { API_ENDPOINTS };