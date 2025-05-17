import axios from 'axios';

export async function sendText(phone: string, text: string) {

    const instanceId = '3D5D753EC73730C39790AA2978EB8413';
    const token = '3BDAB4B67AD6D83056BCEC3B';
    const clientToken = 'F8746e758e9774575b2b4cd1c90dc2b5cS'; // Replace with your actual Client-Token

    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

    const data = {
        phone: phone,
        message: text
    };

    const config = {
        headers: {
            'Client-Token': clientToken,
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await axios.post(url, data, config);
        console.log('Message sent successfully');
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}
