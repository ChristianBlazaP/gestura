import API from './api';

export async function sendToServer(landmarks) {
  try {
    const response = await API.post('/api/predict', {
      landmarks: landmarks
    });
    return response.data;
  } catch (error) {
    console.error('Server prediction error:', error);
    throw error;
  }
}
