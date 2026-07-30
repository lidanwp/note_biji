export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { dataset_id, query, top_k } = req.body;

    if (!dataset_id || !query) {
      return res.status(400).json({ error: '缺少必要参数: dataset_id, query' });
    }

    // 先尝试 QA 接口（智能问答）
    const qaResponse = await fetch('http://129.204.21.82:5050/api/v1/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id,
        query
      })
    });

    // 读取原始字节，手动解码为 UTF-8，避免乱码
    const qaBuffer = await qaResponse.arrayBuffer();
    const qaText = Buffer.from(qaBuffer).toString('utf-8');
    const qaData = JSON.parse(qaText);

    // 如果 QA 返回了有效答案，直接使用
    if (qaData?.data?.answer && qaData.data.answer.trim() && qaData.data.answer.trim() !== '无法回答此问题') {
      return res.status(200).json({
        success: true,
        answer: qaData.data.answer,
        source: 'qa',
        context: qaData.data.context || []
      });
    }

    // QA 没有有效答案，回退到搜索接口
    const searchResponse = await fetch('http://129.204.21.82:5050/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id,
        query,
        top_k: top_k || 5
      })
    });

    const searchBuffer = await searchResponse.arrayBuffer();
    const searchText = Buffer.from(searchBuffer).toString('utf-8');
    const searchData = JSON.parse(searchText);

    // 从搜索结果中提取前几个相关片段作为答案
    const results = searchData?.data?.results || searchData?.results || [];
    const answer = results.length > 0
      ? results.map(r => r.content || '').join('\n\n')
      : '抱歉，没有在知识库中找到相关内容。请尝试换个说法或关键词。';

    return res.status(200).json({
      success: true,
      answer,
      source: 'search',
      results
    });
  } catch (error) {
    console.error('ChatBot proxy error:', error);
    return res.status(500).json({ error: '服务器错误', message: error.message });
  }
}
