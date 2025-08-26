// test-api.js - simple test file to check if the API works
import fetch from 'node-fetch';

const testApi = async () => {
    try {
        const response = await fetch('http://localhost:8080/api/GetSurveyQuestions');
        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
};

testApi();
