"""
Few-shot Learning 数学题解答系统
基于示例学习，让AI按照指定格式解答新题目
"""

import json
import re
import os
from typing import List, Dict, Tuple, Optional

try:
    import requests
except ImportError:
    print("请安装 requests: pip install requests")


class MathQASystem:
    """数学题智能解答系统"""

    def __init__(self, dataset_path: str, api_key: str = None):
        """
        初始化系统

        Args:
            dataset_path: JSONL数据集路径
            api_key: 硅基流动API密钥
        """
        self.dataset_path = dataset_path
        self.api_key = api_key or os.getenv('SILICON_FLOW_API_KEY', '')
        self.dataset: List[Dict] = []
        self.base_url = 'https://api.siliconflow.cn/v1/chat/completions'
        self.model = 'deepseek-ai/DeepSeek-V3.2'  # DeepSeek V3.2 模型
        self.max_tokens = 8192  # 最大输出token

    def load_dataset(self) -> List[Dict]:
        """加载数据集"""
        print(f'加载数据集: {self.dataset_path}')
        self.dataset = []

        with open(self.dataset_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                    if item.get('input') and item.get('output'):
                        self.dataset.append(item)
                except json.JSONDecodeError:
                    continue

        print(f'加载了 {len(self.dataset)} 条数据')
        return self.dataset

    def extract_keywords(self, text: str) -> List[str]:
        """提取关键词"""
        # 移除LaTeX公式
        clean = re.sub(r'\$[^$]+\$', ' ', text)
        clean = re.sub(r'\\[^\\s]+', ' ', clean)

        # 提取中文字符序列
        chinese_words = re.findall(r'[\u4e00-\u9fa5]+', clean)

        # 提取英文单词
        english_words = re.findall(r'[a-zA-Z]+', clean)

        # 合并并去重，优先选择2个字以上的词
        all_words = [w for w in chinese_words + english_words if len(w) >= 2][:20]
        return list(set(all_words))

    def select_examples(self, question: str, example_count: int = 3) -> List[Dict]:
        """
        选择最相似的示例

        Args:
            question: 用户问题
            example_count: 选择的示例数量
        """
        question_lower = question.lower()
        keywords = self.extract_keywords(question_lower)

        # 计算每个示例的得分
        scored = []
        for example in self.dataset:
            example_text = (example['input'] + ' ' + example['output']).lower()
            score = 0

            # 关键词匹配得分
            for keyword in keywords:
                if keyword in example_text:
                    score += 1

            # 题目长度相似度加分
            len_diff = abs(len(example['input']) - len(question))
            if len_diff < 200:
                score += (200 - len_diff) / 200

            scored.append((example, score))

        # 按得分排序，选择最高分的
        scored.sort(key=lambda x: x[1], reverse=True)
        return [item[0] for item in scored[:example_count]]

    def build_prompt(self, question: str, example_count: int = 3) -> Dict:
        """
        构建Few-shot提示词

        Args:
            question: 用户问题
            example_count: 使用的示例数量

        Returns:
            包含 system_prompt, examples_prompt, user_prompt 的字典
        """
        selected_examples = self.select_examples(question, example_count)

        system_prompt = """你是一个专业的数学解题专家，擅长高等数学、线性代数、概率论等数学科目的解题。

重要：不要输出任何思考过程或分析过程，直接输出格式化的答案！

请按照以下格式解答数学问题：

《答案》【答案】《/答案》
《分析》【思路分析】
[详细分析解题思路]
《/分析》
《步骤》$\\color{#FF5405}{\\bold{第一步：xxx}}$《/步骤》
[具体步骤]
《注释》[补充说明或注意事项]《/注释》

注意：
1. LaTeX公式使用$...$或$$...$$包裹
2. 答案要精确，步骤要详细
3. 分析要有逻辑性，解释为什么这样做"""

        examples_prompt = '\n\n【示例学习】请参考以下示例的格式和风格：\n\n'

        for i, example in enumerate(selected_examples, 1):
            examples_prompt += f"""【示例 {i}】
题目：{self.clean_question(example['input'])}

解析：{self.clean_answer(example['output'])}

"""

        user_prompt = f"""【新题目】请解答以下数学题：

{question}

请按照示例格式给出详细解答。"""

        return {
            'system_prompt': system_prompt,
            'examples_prompt': examples_prompt,
            'user_prompt': user_prompt,
            'selected_examples': [
                {
                    'input': e['input'][:100] + '...',
                    'output': e['output'][:100] + '...'
                }
                for e in selected_examples
            ]
        }

    @staticmethod
    def clean_question(text: str) -> str:
        """清理题目文本"""
        return text.replace('\\n', '\n').replace('\\\\', '\\').strip()

    @staticmethod
    def clean_answer(text: str) -> str:
        """清理答案文本"""
        return text.replace('\\n', '\n').replace('\\\\', '\\').strip()

    def call_api(self, messages: List[Dict], temperature: float = 0.7,
                 max_tokens: int = 2000) -> Dict:
        """
        调用硅基流动API

        Args:
            messages: 消息列表
            temperature: 温度参数
            max_tokens: 最大token数

        Returns:
            API响应
        """
        if not self.api_key:
            raise ValueError('未设置API密钥，请设置 SILICON_FLOW_API_KEY 环境变量')

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}'
        }

        payload = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens
        }

        response = requests.post(
            self.base_url,
            headers=headers,
            json=payload,
            timeout=120
        )

        if response.status_code != 200:
            raise Exception(f'API调用失败: {response.status_code} - {response.text}')

        result = response.json()

        if 'error' in result:
            raise Exception(f'API错误: {result["error"]}')

        # Qwen3.5模型可能使用reasoning_content字段
        message = result['choices'][0]['message']
        if not message.get('content') and message.get('reasoning_content'):
            message['content'] = message['reasoning_content']

        return result

    def solve(self, question: str, example_count: int = 3) -> Dict:
        """
        解答数学题

        Args:
            question: 数学题题目
            example_count: 使用的示例数量

        Returns:
            包含 answer, usage, model 的字典
        """
        # 构建提示词
        prompt = self.build_prompt(question, example_count)

        print('选择的示例:')
        for i, ex in enumerate(prompt['selected_examples'], 1):
            print(f'  示例{i}: {ex["input"][:60]}...')
        print()

        # 构建消息
        messages = [
            {'role': 'system', 'content': prompt['system_prompt']},
            {'role': 'user', 'content': prompt['examples_prompt'] + '\n\n' + prompt['user_prompt']}
        ]

        # 调用API
        print('调用硅基流动API...')
        response = self.call_api(messages)

        raw_content = response['choices'][0]['message']['content']

        # 后处理：从思考内容中提取正式答案
        answer = self.extract_answer_from_thinking(raw_content)

        return {
            'answer': answer,
            'usage': response.get('usage', {}),
            'model': response.get('model', self.model)
        }

    @staticmethod
    def extract_answer_from_thinking(raw_content: str) -> str:
        """
        从思考内容中提取正式答案
        Qwen思考模型会将答案放在思考过程最后
        """
        # 如果不包含Thinking Process，直接返回
        if 'Thinking Process:' not in raw_content:
            return raw_content

        # 尝试找到 "Let's write it out" 或 "Let's generate" 等标记后的内容
        markers = [
            "Let's write it out.",
            "Let's generate",
            "*   **Final Polish:**",
            "*   **Final:**",
            "Okay, ready to generate",
            "Proceeding to generate response",
            "Now, constructing the response",
        ]

        for marker in markers:
            if marker in raw_content:
                idx = raw_content.index(marker) + len(marker)
                answer = raw_content[idx:].strip()
                # 清理到下一个可能的标记之前
                for end_marker in ["*   *", "---", "***", "Note:", "Note -", "Wait,"]:
                    if end_marker in answer:
                        answer = answer[:answer.index(end_marker)].strip()
                if answer:
                    return answer

        # 如果没找到，返回清理后的思考内容最后部分
        # 移除Thinking Process: 标题
        content = raw_content.replace('Thinking Process:', '')
        lines = content.split('\n')

        # 获取最后50行，通常答案在这里
        if len(lines) > 50:
            return '\n'.join(lines[-50:]).strip()

        return raw_content


def main():
    """测试函数"""
    import os

    # 数据集路径
    dataset_path = os.path.join(os.path.dirname(__file__), '..', 'datasets',
                                 'math_one_finetune_dataset.jsonl')
    dataset_path = os.path.normpath(dataset_path)

    # API密钥
    api_key = os.getenv('SILICON_FLOW_API_KEY', '')

    # 创建系统
    qa_system = MathQASystem(dataset_path, api_key)

    # 加载数据集
    qa_system.load_dataset()

    # 测试题目
    test_question = """设总体X的概率分布为
P(X=0)=θ³, P(X=1)=3θ²(1-θ), P(X=2)=3θ(1-θ)², P(X=3)=(1-θ)³
其中0<θ<1，X₁, X₂, ..., Xₙ为来自总体X的简单随机样本。求θ的最大似然估计量，并判定它的期望是否为θ，说明理由。"""

    # 构建提示词测试
    prompt = qa_system.build_prompt(test_question, 3)
    print('=== 提示词构建成功 ===')
    print(f"选择的示例数: {len(prompt['selected_examples'])}")

    # 如果有API密钥，进行完整测试
    if api_key:
        print('\n=== 调用API测试 ===')
        result = qa_system.solve(test_question)
        print(f"模型: {result['model']}")
        print(f"Token使用: {result['usage']}")
        print(f"\n答案预览:\n{result['answer'][:500]}...")
    else:
        print('\n请设置 SILICON_FLOW_API_KEY 环境变量以进行API测试')


if __name__ == '__main__':
    main()
