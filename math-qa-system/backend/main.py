"""
数学题智能解答系统 - FastAPI 后端
支持 Few-shot Learning
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
import json
import os
import re
import requests

# API配置
API_KEY = "sk-phuapszjdocebfmngytmyjqwlztpcljjhtpgawwfnapozlgv"
API_URL = "https://api.siliconflow.cn/v1/chat/completions"
MODEL = "deepseek-ai/DeepSeek-V3.2"

# 数据集路径
DATASET_FILE = "math_one_finetune_dataset.jsonl"

app = FastAPI(title="数学题智能解答系统", version="1.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 数据模型 ============

class Question(BaseModel):
    question: str
    example_count: int = 3

class DataItem(BaseModel):
    input: str
    output: str

class DatasetResponse(BaseModel):
    total: int
    items: List[Dict]

# ============ 工具函数 ============

def load_dataset() -> List[Dict]:
    """加载数据集"""
    if not os.path.exists(DATASET_FILE):
        return []
    
    dataset = []
    with open(DATASET_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    item = json.loads(line)
                    if item.get('input') and item.get('output'):
                        dataset.append(item)
                except json.JSONDecodeError:
                    continue
    return dataset

def save_dataset(dataset: List[Dict]) -> None:
    """保存数据集到文件"""
    with open(DATASET_FILE, 'w', encoding='utf-8') as f:
        for item in dataset:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')

def extract_keywords(text: str) -> List[str]:
    """提取关键词"""
    clean = re.sub(r'\$[^$]+\$', ' ', text)
    clean = re.sub(r'\\[^\\s]+', ' ', clean)
    
    chinese_words = re.findall(r'[\u4e00-\u9fa5]+', clean)
    english_words = re.findall(r'[a-zA-Z]+', clean)
    
    words = [w for w in chinese_words + english_words if len(w) >= 2][:20]
    return list(set(words))

def select_examples(question: str, dataset: List[Dict], count: int = 3) -> List[Dict]:
    """根据问题选择最相关的示例"""
    if not dataset:
        return []
    
    question_lower = question.lower()
    keywords = extract_keywords(question_lower)
    
    scored = []
    for item in dataset:
        item_text = (item['input'] + ' ' + item['output']).lower()
        score = 0
        
        for kw in keywords:
            if kw in item_text:
                score += 1
        
        len_diff = abs(len(item['input']) - len(question))
        if len_diff < 200:
            score += (200 - len_diff) / 200
        
        scored.append((item, score))
    
    scored.sort(key=lambda x: x[1], reverse=True)
    return [item[0] for item in scored[:count]]

def call_api(messages: List[Dict]) -> Dict:
    """调用硅基流动API"""
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    }
    
    payload = {
        'model': MODEL,
        'messages': messages,
        'temperature': 0.7,
        'max_tokens': 8192
    }
    
    response = requests.post(API_URL, headers=headers, json=payload, timeout=300)
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"API调用失败: {response.text}")
    
    result = response.json()
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    
    return result

# ============ API路由 ============

@app.get("/")
async def root():
    """根路径"""
    return {"message": "数学题智能解答系统 API", "version": "1.0.0"}

@app.get("/dataset")
async def get_dataset(limit: int = 1000) -> DatasetResponse:
    """获取数据集"""
    dataset = load_dataset()
    return DatasetResponse(total=len(dataset), items=dataset[:limit])

@app.post("/dataset")
async def add_data(item: DataItem) -> Dict:
    """添加数据到数据集"""
    dataset = load_dataset()
    
    # 检查是否重复
    for existing in dataset:
        if existing.get('input', '').startswith(item.input[:50]):
            return {"message": "数据已存在", "total": len(dataset)}
    
    dataset.append({"input": item.input, "output": item.output})
    save_dataset(dataset)
    
    return {"message": "添加成功", "total": len(dataset)}

@app.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...)) -> Dict:
    """上传JSONL文件"""
    if not file.filename.endswith('.jsonl'):
        raise HTTPException(status_code=400, detail="只支持.jsonl文件")
    
    content = await file.read()
    lines = content.decode('utf-8').strip().split('\n')
    
    new_items = []
    for line in lines:
        if line.strip():
            try:
                item = json.loads(line)
                if item.get('input') and item.get('output'):
                    new_items.append(item)
            except json.JSONDecodeError:
                continue
    
    # 合并数据
    dataset = load_dataset()
    existing_inputs = {d.get('input', '')[:50] for d in dataset}
    new_unique = [d for d in new_items if d.get('input', '')[:50] not in existing_inputs]
    
    dataset.extend(new_unique)
    save_dataset(dataset)
    
    return {"message": f"上传成功，新增 {len(new_unique)} 条数据", "total": len(dataset)}

@app.delete("/dataset/{index}")
async def delete_data(index: int) -> Dict:
    """删除数据"""
    dataset = load_dataset()
    if index < 0 or index >= len(dataset):
        raise HTTPException(status_code=404, detail="索引超出范围")
    
    dataset.pop(index)
    save_dataset(dataset)
    
    return {"message": "删除成功", "total": len(dataset)}

@app.post("/solve")
async def solve_question(question: Question) -> Dict:
    """解答数学题 - Few-shot Learning"""
    dataset = load_dataset()
    
    # 构建提示词
    system_prompt = """你是一个专业的数学解题专家，擅长高等数学、线性代数、概率论等数学科目的解题。

请按照以下格式解答数学问题：

《答案》【答案】《/答案》
《分析》【思路分析】[详细分析解题思路]《/分析》
《步骤》[具体步骤，每个关键步骤后可以用《注释》解释原理]《/步骤》

注意：
1. LaTeX公式使用$...$或$$...$$包裹
2. 答案要精确，分析思路、步骤要详细、注释要详细位置要合理
3. 分析要有逻辑性，解释为什么这样做
4. 《注释》标签要在关键位置使用，解释该步骤的原理、依据、使用的二级结论、秒杀技巧、或注意事项，例如：
   《步骤》求导得到$f'(x)=2x$《/步骤》
   《注释》这里使用了幂函数求导法则$(x^n)'=nx^{n-1}$《/注释》
5. 不要输出任何思考过程，只输出格式化答案
6. 求和、积分、极限、乘积等等必要时需要使用\limits_
7. 推荐提供多种解法（常规解法+巧解）"""
    
    # 选择相关示例
    examples = select_examples(question.question, dataset, question.example_count)
    
    # 构建用户消息
    user_content = ""
    if examples:
        user_content = "【示例学习】请参考以下示例的格式和风格，特别是每一个标签的内容位置：\n\n"
        for i, ex in enumerate(examples, 1):
            user_content += f"【示例{i}】\n题目：{ex['input']}\n\n解析：{ex['output']}\n\n"
        user_content += f"【新题目】请解答以下数学题：\n\n{question.question}\n\n请按照示例格式给出详细解答。"
    else:
        user_content = question.question
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    # 调用API
    result = call_api(messages)
    answer = result['choices'][0]['message']['content']
    usage = result.get('usage', {})
    
    return {
        "answer": answer,
        "usage": usage,
        "model": MODEL,
        "examples_used": len(examples),
        "examples": [
            {"input": e['input'][:100] + "...", "output": e['output'][:100] + "..."}
            for e in examples
        ]
    }

@app.post("/preview")
async def preview_format(data: DataItem) -> Dict:
    """预览格式化后的效果"""
    text = data.output
    
    # 简单的格式化处理
    text = text.replace('《答案》', '<span style="color:#fff;background-color:#009688;padding:2px 6px;">答案</span>')
    text = text.replace('《分析》', '<span style="color:#fff;background-color:#009688;padding:2px 6px;">分析</span>')
    text = text.replace('《步骤》', '<span style="color:#fff;background-color:#E91E63;padding:2px 6px;">步骤</span>')
    text = text.replace('《注释》', '<span style="color:#009688;">注释</span>')
    text = text.replace('《/答案》', '')
    text = text.replace('《/分析》', '')
    text = text.replace('《/步骤》', '')
    text = text.replace('《/注释》', '')
    
    return {"html": text}

if __name__ == "__main__":
    print("=" * 50)
    print("数学题智能解答系统")
    print("=" * 50)
    print(f"API: {API_URL}")
    print(f"Model: {MODEL}")
    print(f"Dataset: {DATASET_FILE}")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
