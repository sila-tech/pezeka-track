import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({ 
    apiKey: 'AIzaSyAxIHPPMWkWxJ6KMp_w5XMWhtUyogWDLxY',
    apiVersion: 'v1beta'
  })],
});
