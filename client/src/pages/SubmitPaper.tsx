import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { Upload, Plus, X, Save, ArrowLeft } from 'lucide-react';

interface Author {
  name: string;
  email: string;
  affiliation: string;
  is_corresponding: boolean;
}

export default function SubmitPaper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [authors, setAuthors] = useState<Author[]>([
    { name: '', email: '', affiliation: '', is_corresponding: true },
  ]);
  const [selectedFields, setSelectedFields] = useState<number[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFields();
    if (isEdit) {
      loadPaper();
    }
  }, [id]);

  const loadFields = async () => {
    try {
      const res = await api.get('/fields');
      setFields(res.data.fields);
    } catch (err) {
      console.error('加载领域失败', err);
    }
  };

  const loadPaper = async () => {
    try {
      const res = await api.get(`/papers/${id}`);
      const paper = res.data.paper;
      setTitle(paper.title);
      setAbstract(paper.abstract);
      setKeywords(paper.keywords || []);
      setAuthors(paper.authors || []);
      setFileName(paper.file_name || '');
    } catch (err) {
      console.error('加载稿件失败', err);
    }
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  const handleAddAuthor = () => {
    setAuthors([...authors, { name: '', email: '', affiliation: '', is_corresponding: false }]);
  };

  const handleRemoveAuthor = (index: number) => {
    if (authors.length > 1) {
      setAuthors(authors.filter((_, i) => i !== index));
    }
  };

  const handleAuthorChange = (index: number, field: keyof Author, value: any) => {
    const newAuthors = [...authors];
    if (field === 'is_corresponding' && value) {
      newAuthors.forEach((a, i) => {
        newAuthors[i] = { ...a, is_corresponding: i === index };
      });
    } else {
      newAuthors[index] = { ...newAuthors[index], [field]: value };
    }
    setAuthors(newAuthors);
  };

  const handleFieldToggle = (fieldId: number) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(id => id !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('请上传PDF文件');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('文件大小不能超过50MB');
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('请填写论文标题');
      return;
    }
    if (!abstract.trim()) {
      setError('请填写摘要');
      return;
    }
    if (!file && !isEdit) {
      setError('请上传PDF论文文件');
      return;
    }
    if (authors.some(a => !a.name.trim())) {
      setError('请填写所有作者的姓名');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('abstract', abstract);
      formData.append('keywords', JSON.stringify(keywords));
      formData.append('authors', JSON.stringify(authors));
      formData.append('fields', JSON.stringify(selectedFields));
      if (file) {
        formData.append('file', file);
      }
      if (isEdit && versionNotes) {
        formData.append('version_notes', versionNotes);
      }

      let res;
      if (isEdit) {
        res = await api.put(`/papers/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/papers', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate(`/papers/${res.data.paper.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const fieldCategories = [...new Set(fields.map(f => f.category))];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold text-gray-800">
          {isEdit ? '提交修改稿' : '提交新稿件'}
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">基本信息</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                论文标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="请输入论文标题"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                摘要 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={abstract}
                onChange={e => setAbstract(e.target.value)}
                rows={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="请输入论文摘要"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                关键词
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="输入关键词后按回车添加"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-primary-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">作者信息</h3>
          
          <div className="space-y-4">
            {authors.map((author, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg relative">
                {authors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAuthor(index)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                )}
                
                <p className="text-sm font-medium text-gray-600 mb-3">作者 {index + 1}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
                    <input
                      type="text"
                      value={author.name}
                      onChange={e => handleAuthorChange(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="作者姓名"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">邮箱</label>
                    <input
                      type="email"
                      value={author.email}
                      onChange={e => handleAuthorChange(index, 'email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="作者邮箱"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">单位</label>
                    <input
                      type="text"
                      value={author.affiliation}
                      onChange={e => handleAuthorChange(index, 'affiliation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="作者单位"
                    />
                  </div>
                </div>
                
                <label className="flex items-center gap-2 mt-3">
                  <input
                    type="radio"
                    name={`corresponding-${index}`}
                    checked={author.is_corresponding}
                    onChange={() => handleAuthorChange(index, 'is_corresponding', true)}
                    className="text-primary-600"
                  />
                  <span className="text-sm text-gray-600">通讯作者</span>
                </label>
              </div>
            ))}
            
            <button
              type="button"
              onClick={handleAddAuthor}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              添加作者
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">研究领域</h3>
          <p className="text-sm text-gray-500 mb-4">请选择论文所属的研究领域，以便我们为您匹配合适的审稿人</p>
          
          <div className="space-y-4">
            {fieldCategories.map(category => (
              <div key={category}>
                <p className="text-sm font-medium text-gray-700 mb-2">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {fields
                    .filter(f => f.category === category)
                    .map(field => (
                      <label
                        key={field.id}
                        className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                          selectedFields.includes(field.id)
                            ? 'bg-primary-100 text-primary-700 border border-primary-300'
                            : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.id)}
                          onChange={() => handleFieldToggle(field.id)}
                          className="sr-only"
                        />
                        {field.name}
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">论文文件</h3>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="mx-auto text-gray-400 mb-3" size={40} />
              <p className="text-gray-700 font-medium">
                {fileName ? fileName : '点击上传PDF文件'}
              </p>
              <p className="text-sm text-gray-500 mt-1">支持PDF格式，最大50MB</p>
            </label>
          </div>
        </div>

        {isEdit && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">修改说明</h3>
            <textarea
              value={versionNotes}
              onChange={e => setVersionNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="请简要说明本次修改的主要内容（可选）"
            />
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={18} />
            {loading ? '提交中...' : isEdit ? '提交修改稿' : '提交稿件'}
          </button>
        </div>
      </form>
    </div>
  );
}
