const { getSupabaseClient } = require('../src/storage/database/supabase-client');

async function clearAllQuestions() {
  console.log('正在清空所有题目数据...');
  const client = await getSupabaseClient();
  
  const { error } = await client.from('questions').delete().neq('id', '');
  if (error) {
    console.error('清空失败:', error);
    process.exit(1);
  }
  
  console.log('清空成功！');
  process.exit(0);
}

clearAllQuestions();