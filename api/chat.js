export default async function handler(req, res) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { dataset_id, query, top_k } = req.body;

    if (!dataset_id || !query) {
      return res.status(400).json({ error: '缺少必要参数: dataset_id, query' });
    }

    const response = await fetch('http://129.204.21.82:5050/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id,
        query,
        top_k: top_k || 5
      })
    });

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error('ChatBot proxy error:', error);
    return res.status(500).json({ error: '服务器错误', message: error.message });
  }
}
