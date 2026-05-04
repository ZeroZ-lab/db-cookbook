# 文档解析规则

## 支持的文件类型

| 文件类型 | 解析器 | 输出 |
| --- | --- | --- |
| PDF | PyPDF2 / pdfplumber | 文本 + 页面号 |
| Markdown | 正则解析 | 文本 + 标题层级 |
| HTML | BeautifulSoup | 文本 + 结构 |
| 代码文件 | 语言特定解析器 | 代码 + 注释 |

## 解析规则

### 1. PDF 解析

```python
def parse_pdf(file_path):
    """解析 PDF 文件，提取文本和页面信息"""
    import pdfplumber

    chunks = []
    with pdfplumber.open(file_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text:
                chunks.append({
                    'text': text,
                    'page': page_num,
                    'source_uri': f'{file_path}#page={page_num}'
                })
    return chunks
```

### 2. Markdown 解析

```python
def parse_markdown(file_path):
    """解析 Markdown 文件，按标题层级切分"""
    with open(file_path, 'r') as f:
        content = f.read()

    chunks = []
    current_title = ''
    current_text = ''

    for line in content.split('\n'):
        if line.startswith('#'):
            if current_text:
                chunks.append({
                    'text': current_text.strip(),
                    'title': current_title,
                    'source_uri': f'{file_path}#{current_title}'
                })
            current_title = line.lstrip('#').strip()
            current_text = ''
        else:
            current_text += line + '\n'

    if current_text:
        chunks.append({
            'text': current_text.strip(),
            'title': current_title,
            'source_uri': f'{file_path}#{current_title}'
        })

    return chunks
```

### 3. 代码文件解析

```python
def parse_code(file_path, language):
    """解析代码文件，提取函数和注释"""
    with open(file_path, 'r') as f:
        content = f.read()

    chunks = []
    # 按函数/类切分
    # 保留函数名、参数、返回值、docstring
    # source_uri 指向具体函数位置

    return chunks
```

## Chunk 策略

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| chunk_size | 512 tokens | 每个 chunk 的最大 token 数 |
| chunk_overlap | 50 tokens | chunk 之间的重叠 token 数 |
| split_by | 段落/标题 | 切分依据 |
| min_chunk_size | 100 tokens | 最小 chunk 大小 |

## 元数据保留

每个 chunk 必须保留以下元数据：

- `source_uri`: 文档来源 URI（文件路径 + 位置）
- `chunk_index`: chunk 在文档中的序号
- `document_id`: 所属文档 ID
- `created_at`: 创建时间
- `embedding_model`: 使用的 embedding 模型
- `embedding_version`: embedding 模型版本

## 失败归因

| 失败类型 | 原因 | 处理方式 |
| --- | --- | --- |
| 解析失败 | 文件格式不支持或损坏 | 记录错误日志，跳过该文件 |
| chunk 过大 | 内容超过 chunk_size | 进一步切分 |
| chunk 过小 | 内容少于 min_chunk_size | 合并到相邻 chunk |
| embedding 失败 | API 调用失败 | 重试 3 次，仍失败则记录 |
