
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RawTrade } from '../types';
import {
  detectBroker, getBrokerConfig, normalizeRow, BROKER_DISPLAY_NAMES, BrokerName,
} from '../services/brokerAdapters';

declare const Papa: any;

interface FileUploadProps {
  onDataParsed: (data: RawTrade[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  existingAccounts: string[];
  lastImportDate: string | null;
  importProgress: number;
  importStep: string;
  setImportProgress: (v: number) => void;
  setImportStep: (v: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onDataParsed,
  setIsLoading,
  isLoading,
  setError,
  existingAccounts = [],
  lastImportDate = null,
  importProgress,
  importStep,
  setImportProgress,
  setImportStep,
}) => {
  const [accountName, setAccountName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAccountOptions, setShowAccountOptions] = useState(false);
  const [detectedBroker, setDetectedBroker] = useState<BrokerName | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredAccountOptions = useMemo(() => 
    existingAccounts.filter(acc => acc.toLowerCase().includes(accountName.toLowerCase())),
    [existingAccounts, accountName]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDetectedBroker(null);
    }
  };

  const handleParse = () => {
    if (!selectedFile) {
      setError("Please select a file to upload.");
      return;
    }
    if (!accountName.trim()) {
      setError("Please select or enter an account name.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setImportProgress(10);
    setImportStep('解析 CSV...');

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results: { data: Record<string, string>[]; errors: any[]; meta: { fields?: string[] } }) => {
        if (results.errors.length) {
          console.error("CSV parsing errors:", results.errors);
          setError(`Error parsing CSV: ${results.errors[0].message}`);
          setIsLoading(false);
          return;
        }

        // Detect broker format and normalize columns to standard RawTrade shape
        const broker = detectBroker(results.meta.fields ?? []);
        const config = getBrokerConfig(broker);
        setDetectedBroker(broker);

        const normalized = results.data.map(row => {
          const r = normalizeRow(row, config);
          // Override Account with user-supplied name
          r.Account = accountName.trim();
          return r;
        });

        setImportProgress(25);
        setImportStep('上傳資料...');
        onDataParsed(normalized);
        setIsLoading(false);
        // Reset after successful parse
        setAccountName('');
        setSelectedFile(null);
        // Clear the file input visually
        const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      },
      error: (err: Error) => {
        console.error("PapaParse error:", err);
        setError(`Failed to read file: ${err.message}`);
        setIsLoading(false);
        setImportProgress(0);
        setImportStep('');
      }
    });
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Signal Acquisition</h2>
        </div>
        {lastImportDate && (
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Sync</p>
            <p className="text-[10px] font-bold text-indigo-600 tracking-tight">{lastImportDate}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Portfolio Assignment</label>
          <div ref={dropdownRef} className="relative">
            <input 
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              onFocus={() => setShowAccountOptions(true)}
              placeholder="Assign to identity..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 outline-none transition-all text-[11px] font-bold text-slate-700 placeholder:text-slate-300"
              disabled={isLoading}
            />
            <div className="absolute right-3 top-2.5 text-slate-300 pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </div>

            {showAccountOptions && (
              <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl mt-2 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="max-h-48 overflow-y-auto py-1">
                  {filteredAccountOptions.length > 0 ? (
                    filteredAccountOptions.map((acc) => (
                      <button
                        key={acc}
                        className="w-full text-left px-4 py-2 text-[10px] text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center font-bold"
                        onClick={() => {
                          setAccountName(acc);
                          setShowAccountOptions(false);
                        }}
                      >
                        <svg className="w-3 h-3 mr-2 opacity-30" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path></svg>
                        {acc}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-[10px] text-slate-400 italic">No matches...</div>
                  )}
                </div>
                {accountName.trim() && !existingAccounts.includes(accountName.trim()) && (
                  <div className="border-t border-slate-50 p-2 bg-slate-50/50">
                    <button
                      className="w-full text-left px-2 py-1 text-[9px] text-indigo-600 font-black uppercase tracking-widest hover:text-indigo-700 transition-all"
                      onClick={() => setShowAccountOptions(false)}
                    >
                      [+] New: {accountName}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center w-full">
          <label htmlFor="csv-upload" className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${selectedFile ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-slate-100/50'}`}>
            <div className="flex flex-col items-center justify-center text-center">
              <svg className={`w-6 h-6 mb-1 transition-colors ${selectedFile ? 'text-indigo-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <p className={`mb-0.5 text-[10px] font-black uppercase tracking-tight ${selectedFile ? 'text-slate-800' : 'text-slate-400'}`}>
                {selectedFile ? selectedFile.name : 'Select Tactical CSV'}
              </p>
              <p className="text-[8px] text-slate-300 uppercase tracking-[0.2em] font-bold">Standard Broker Output</p>
            </div>
            <input id="csv-upload" type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
          </label>
        </div>

        {detectedBroker && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold ${
            detectedBroker === 'unknown'
              ? 'bg-amber-50 border border-amber-100 text-amber-600'
              : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
          }`}>
            {detectedBroker === 'unknown' ? (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            )}
            <span className="uppercase tracking-widest text-[9px] font-black">
              {detectedBroker === 'unknown' ? 'Unknown Format — may not parse correctly' : BROKER_DISPLAY_NAMES[detectedBroker]}
            </span>
          </div>
        )}

        <button
          onClick={handleParse}
          disabled={isLoading || importProgress > 0 || !selectedFile || !accountName.trim()}
          className="w-full py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-300 transition-all active:scale-95 uppercase tracking-widest text-[10px] flex items-center justify-center"
        >
          {isLoading ? (
            <div className="flex items-center">
              <svg className="animate-spin h-3.5 w-3.5 mr-2 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Processing Stream...
            </div>
          ) : 'Execute Import Sequence'}
        </button>

        {importProgress > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{importStep}</span>
              <span className={`text-[9px] font-black uppercase tracking-widest ${importProgress === 100 ? 'text-emerald-500' : 'text-indigo-500'}`}>{importProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${importProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default FileUpload;
