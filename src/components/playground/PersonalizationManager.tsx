import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { Upload, FileText, Plus, X, Download, Copy, Check, Users, AlertCircle, ChevronDown, ChevronUp, Edit2, Trash2, FileSpreadsheet } from 'lucide-react';

interface PersonalizationColumn {
    name: string;
    usage_note: string;
    example?: string;
    data_type?: string;
    confidence?: number;
    personalization_potential?: string;
}

interface PersonalizationRecord {
    id: string;
    unique_id: string;
    data: Record<string, any>;
    created_at?: string;
}

interface PersonalizationTemplate {
    id?: string;
    name: string;
    columns: PersonalizationColumn[];
    created_at?: string;
    updated_at?: string;
    record_count?: number;
}

interface PersonalizationManagerProps {
    brdgeId: string;
    apiBaseUrl: string;
    authToken?: string | null;
    shareableLink: string;
}

export const PersonalizationManager: React.FC<PersonalizationManagerProps> = ({
    brdgeId,
    apiBaseUrl,
    authToken,
    shareableLink
}) => {
    const [templates, setTemplates] = useState<PersonalizationTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<PersonalizationTemplate | null>(null);
    const [records, setRecords] = useState<PersonalizationRecord[]>([]);
    const [showCreationForm, setShowCreationForm] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isCreatingRecord, setIsCreatingRecord] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);
    const [uploadMode, setUploadMode] = useState<'manual' | 'csv'>('manual');
    const [showLinkModal, setShowLinkModal] = useState<{ uniqueId: string; link: string } | null>(null);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ recordId: string; recordData: Record<string, any> } | null>(null);
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
    const [bulkDeleteConfirmModal, setBulkDeleteConfirmModal] = useState<{ recordIds: string[]; recordCount: number } | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [deleteTemplateConfirmModal, setDeleteTemplateConfirmModal] = useState<PersonalizationTemplate | null>(null);

    // New template creation state
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newColumns, setNewColumns] = useState<PersonalizationColumn[]>([
        { name: 'name', usage_note: 'The recipient\'s name', example: 'John Smith' },
        { name: 'company', usage_note: 'The recipient\'s company', example: 'Acme Corp' }
    ]);

    // Manual record entry state
    const [manualRecord, setManualRecord] = useState<Record<string, string>>({});

    // Add new state for CSV-first workflow
    const [csvFirstMode, setCsvFirstMode] = useState(false);
    const [analyzingCsv, setAnalyzingCsv] = useState(false);
    const [csvAnalysis, setCsvAnalysis] = useState<any>(null);
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [editingTemplateName, setEditingTemplateName] = useState('');
    const [editingColumns, setEditingColumns] = useState<PersonalizationColumn[]>([]);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [csvFileForCreation, setCsvFileForCreation] = useState<File | null>(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState<{
        show: boolean;
        templateName: string;
        recordCount: number;
    }>({ show: false, templateName: '', recordCount: 0 });

    const fetchTemplates = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${apiBaseUrl}/brdges/${brdgeId}/personalization/templates`, {
                headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                credentials: 'omit'
            });

            if (response.ok) {
                const data = await response.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error('Error fetching templates:', err);
            setError('Failed to load personalization templates');
        } finally {
            setIsLoading(false);
        }
    }, [apiBaseUrl, authToken, brdgeId]);

    // Fetch templates on mount
    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const fetchRecords = async (templateId: string) => {
        try {
            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/templates/${templateId}/records`,
                {
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                    credentials: 'omit'
                }
            );

            if (response.ok) {
                const data = await response.json();
                setRecords(data.records || []);
                setSelectedRecords(new Set()); // Clear selections when switching templates
            }
        } catch (err) {
            console.error('Error fetching records:', err);
        }
    };

    const createTemplate = async () => {
        if (!newTemplateName.trim() || newColumns.length === 0) return;

        try {
            setIsCreating(true);
            setError(null);
            setShowSuccessMessage({ show: false, templateName: '', recordCount: 0 });

            const response = await fetch(`${apiBaseUrl}/brdges/${brdgeId}/personalization/templates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                credentials: 'omit',
                body: JSON.stringify({
                    name: newTemplateName,
                    columns: newColumns
                })
            });

            if (response.ok) {
                const data = await response.json();
                await fetchTemplates();
                setSelectedTemplate(data.template);
                setNewTemplateName('');
                setNewColumns([
                    { name: 'name', usage_note: 'The recipient\'s name', example: 'John Smith' },
                    { name: 'company', usage_note: 'The recipient\'s company', example: 'Acme Corp' }
                ]);
                setShowCreationForm(false);
                setUploadMode('manual');

                // Show brief success feedback
                setShowSuccessMessage({
                    show: true,
                    templateName: data.template.name,
                    recordCount: 0
                });
                setTimeout(() => {
                    setShowSuccessMessage({ show: false, templateName: '', recordCount: 0 });
                }, 3000);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to create template');
            }
        } catch (err) {
            console.error('Error creating template:', err);
            setError('Failed to create template');
        } finally {
            setIsCreating(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedTemplate) return;

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('template_id', selectedTemplate.id!.toString());

            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/upload-csv`,
                {
                    method: 'POST',
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                    credentials: 'omit',
                    body: formData
                }
            );

            if (response.ok) {
                await fetchRecords(selectedTemplate.id!);
                await fetchTemplates(); // Refresh to get updated record count
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to upload CSV');
            }
        } catch (err) {
            console.error('Error uploading CSV:', err);
            setError('Failed to upload CSV file');
        } finally {
            setIsUploading(false);
        }
    };

    const createManualRecord = async () => {
        if (!selectedTemplate) return;

        try {
            setIsCreatingRecord(true);
            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/templates/${selectedTemplate.id}/records`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                    },
                    credentials: 'omit',
                    body: JSON.stringify({ data: manualRecord })
                }
            );

            if (response.ok) {
                await fetchRecords(selectedTemplate.id!);
                await fetchTemplates();
                setManualRecord({});
            }
        } catch (err) {
            console.error('Error creating record:', err);
            setError('Failed to create record');
        } finally {
            setIsCreatingRecord(false);
        }
    };

    const handleDeleteClick = (recordId: string, recordData: Record<string, any>) => {
        setDeleteConfirmModal({ recordId, recordData });
    };

    const deleteRecord = async (recordId: string) => {
        try {
            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/records/${recordId}`,
                {
                    method: 'DELETE',
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                    credentials: 'omit'
                }
            );

            if (response.ok && selectedTemplate) {
                await fetchRecords(selectedTemplate.id!);
                await fetchTemplates();
                setDeleteConfirmModal(null);
            }
        } catch (err) {
            console.error('Error deleting record:', err);
            setError('Failed to delete record');
        }
    };

    const toggleRecordSelection = (recordId: string) => {
        const newSelection = new Set(selectedRecords);
        if (newSelection.has(recordId)) {
            newSelection.delete(recordId);
        } else {
            newSelection.add(recordId);
        }
        setSelectedRecords(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedRecords.size === records.length) {
            setSelectedRecords(new Set());
        } else {
            setSelectedRecords(new Set(records.map(record => record.id)));
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedRecords.size === 0) return;
        setBulkDeleteConfirmModal({
            recordIds: Array.from(selectedRecords),
            recordCount: selectedRecords.size
        });
    };

    const bulkDeleteRecords = async () => {
        if (!bulkDeleteConfirmModal) return;

        try {
            setIsBulkDeleting(true);
            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/records/bulk-delete`,
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                    },
                    credentials: 'omit',
                    body: JSON.stringify({ record_ids: bulkDeleteConfirmModal.recordIds })
                }
            );

            if (response.ok && selectedTemplate) {
                await fetchRecords(selectedTemplate.id!);
                await fetchTemplates();
                setSelectedRecords(new Set());
                setBulkDeleteConfirmModal(null);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to delete records');
            }
        } catch (err) {
            console.error('Error bulk deleting records:', err);
            setError('Failed to delete records');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const copyPersonalizedLink = async (uniqueId: string) => {
        const link = `${shareableLink}?id=${uniqueId}`;

        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link);
            } else {
                // Fallback method using a temporary textarea
                const textArea = document.createElement('textarea');
                textArea.value = link;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                    // Show the link modal instead of prompt
                    setShowLinkModal({ uniqueId, link });
                    return;
                }

                document.body.removeChild(textArea);
            }

            // Show success feedback
            setCopiedLinks(prev => {
                const next = new Set(prev);
                next.add(uniqueId);
                return next;
            });
            setTimeout(() => {
                setCopiedLinks(prev => {
                    const next = new Set(prev);
                    next.delete(uniqueId);
                    return next;
                });
            }, 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
            // Show the link modal as a fallback
            setShowLinkModal({ uniqueId, link });
        }
    };

    const exportLinks = () => {
        if (!selectedTemplate || records.length === 0) {
            console.log('Export aborted: no template or records');
            return;
        }

        setIsExporting(true);
        try {
            console.log('Starting export with', records.length, 'records');

            // Build CSV content with BOM for better Excel compatibility
            const BOM = '\uFEFF';
            const headers = [...selectedTemplate.columns.map(col => col.name), 'personalized_link'];
            const csvRows = [
                headers.map(h => `"${h}"`).join(','),
                ...records.map(record => {
                    const values = selectedTemplate.columns.map(col => {
                        const value = record.data[col.name] || '';
                        // Properly escape CSV values
                        const escaped = String(value).replace(/"/g, '""');
                        return `"${escaped}"`;
                    });
                    values.push(`"${shareableLink}?id=${record.unique_id}"`);
                    return values.join(',');
                })
            ];
            const csvContent = BOM + csvRows.join('\r\n'); // Use Windows line endings for better compatibility

            console.log('CSV content length:', csvContent.length);
            console.log('First few lines:', csvContent.substring(0, 200));

            // Create blob with proper MIME type
            const blob = new Blob([csvContent], {
                type: 'text/csv;charset=utf-8'
            });

            console.log('Blob size:', blob.size);

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const safeTemplateName = selectedTemplate.name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
            const filename = `${safeTemplateName}_personalized_links_${timestamp}.csv`;

            console.log('Filename:', filename);

            // Try multiple download methods
            // Method 1: Create an anchor element with download attribute
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.position = 'fixed';
            link.style.top = '0';
            link.style.left = '0';
            link.style.opacity = '0';
            link.style.pointerEvents = 'none';

            document.body.appendChild(link);

            // Try to trigger download - only use one method
            console.log('Attempting download...');

            // Method 1: Standard click (works in most browsers)
            link.click();

            // Don't try alternative methods immediately - they were causing duplicate downloads
            // We'll only use them in the catch block if the primary method fails

            // Clean up after a longer delay
            setTimeout(() => {
                try {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    console.log('Cleanup completed');
                } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError);
                }
            }, 1000);

            // Show success feedback
            setError(null);
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
            console.log(`Export completed: ${records.length} records to ${filename}`);

        } catch (err) {
            console.error('Failed to export links:', err);
            setError('Failed to export links. Please try again.');

            // Fallback method 2: Use a different download approach
            try {
                console.log('Trying fallback download method...');

                // Recreate the CSV content
                const csvContent = [
                    [...selectedTemplate.columns.map(col => col.name), 'personalized_link'].join(','),
                    ...records.map(record => {
                        const values = selectedTemplate.columns.map(col =>
                            `"${(record.data[col.name] || '').toString().replace(/"/g, '""')}"`
                        );
                        values.push(`"${shareableLink}?id=${record.unique_id}"`);
                        return values.join(',');
                    })
                ].join('\n');

                // Try data URI approach
                const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', dataUri);
                link.setAttribute('download', `personalized_links_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                console.log('Fallback download attempted');

            } catch (fallbackErr) {
                console.error('Fallback export also failed:', fallbackErr);

                // Last resort: show data in textarea for manual copy
                const csvContent = [
                    [...selectedTemplate.columns.map(col => col.name), 'personalized_link'].join(','),
                    ...records.map(record => {
                        const values = selectedTemplate.columns.map(col =>
                            `"${(record.data[col.name] || '').toString().replace(/"/g, '""')}"`
                        );
                        values.push(`"${shareableLink}?id=${record.unique_id}"`);
                        return values.join(',');
                    })
                ].join('\n');

                // Create a modal with the CSV content
                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border:2px solid #ccc;z-index:10000;max-width:80%;max-height:80%;overflow:auto;';
                modal.innerHTML = `
                    <h3>Copy CSV Data</h3>
                    <p>Download failed. Please copy the data below and save it as a .csv file:</p>
                    <textarea style="width:100%;height:300px;font-family:monospace;" readonly>${csvContent}</textarea>
                    <button onclick="this.parentElement.remove()" style="margin-top:10px;">Close</button>
                `;
                document.body.appendChild(modal);
            }
        } finally {
            setIsExporting(false);
        }
    };

    const addColumn = () => {
        setNewColumns([...newColumns, { name: '', usage_note: '', example: '' }]);
    };

    const updateColumn = (index: number, field: keyof PersonalizationColumn, value: string) => {
        const updated = [...newColumns];
        updated[index] = { ...updated[index], [field]: value };
        setNewColumns(updated);
    };

    const removeColumn = (index: number) => {
        setNewColumns(newColumns.filter((_, i) => i !== index));
    };

    // New function for CSV analysis
    const analyzeCsvFile = async (file: File) => {
        try {
            setAnalyzingCsv(true);
            setError(null);
            setShowSuccessMessage({ show: false, templateName: '', recordCount: 0 });
            setCsvFileForCreation(file);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/analyze-csv`,
                {
                    method: 'POST',
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                    credentials: 'omit',
                    body: formData
                }
            );

            if (response.ok) {
                const analysis = await response.json();
                setCsvAnalysis(analysis);
                setNewTemplateName(analysis.suggested_template_name || '');
                setNewColumns(analysis.columns || []);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to analyze CSV');
            }
        } catch (err) {
            console.error('Error analyzing CSV:', err);
            setError('Failed to analyze CSV file');
        } finally {
            setAnalyzingCsv(false);
        }
    };

    // Enhanced create template function for CSV-first workflow  
    const createTemplateFromCsv = async (csvFile: File) => {
        try {
            setIsCreating(true);
            setError(null);

            const formData = new FormData();
            formData.append('file', csvFile);
            formData.append('template_name', newTemplateName);
            formData.append('columns', JSON.stringify(newColumns));

            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/create-from-csv`,
                {
                    method: 'POST',
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                    credentials: 'omit',
                    body: formData
                }
            );

            if (response.ok) {
                const data = await response.json();
                await fetchTemplates();

                // Find the newly created template
                const newTemplate = data.template;
                await fetchRecords(newTemplate.id);
                setSelectedTemplate(newTemplate);

                // Reset state
                setCsvFirstMode(false);
                setCsvAnalysis(null);
                setNewTemplateName('');
                setNewColumns([
                    { name: 'name', usage_note: 'The recipient\'s name', example: 'John Smith' },
                    { name: 'company', usage_note: 'The recipient\'s company', example: 'Acme Corp' }
                ]);
                setShowCreationForm(false);

                // Show success state briefly
                setError(null);
                setShowSuccessMessage({
                    show: true,
                    templateName: newTemplate.name,
                    recordCount: data.records_created || 0
                });

                // Hide success message after 5 seconds
                setTimeout(() => {
                    setShowSuccessMessage({ show: false, templateName: '', recordCount: 0 });
                }, 5000);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to create template from CSV');
            }
        } catch (err) {
            console.error('Error creating template from CSV:', err);
            setError('Failed to create template from CSV');
        } finally {
            setIsCreating(false);
        }
    };

    // Template editing functions
    const startEditingTemplate = () => {
        if (!selectedTemplate) return;
        setIsEditingTemplate(true);
        setEditingTemplateName(selectedTemplate.name);
        setEditingColumns([...selectedTemplate.columns]);
        setError(null);
        setShowSuccessMessage({ show: false, templateName: '', recordCount: 0 });
    };

    const cancelEditingTemplate = () => {
        setIsEditingTemplate(false);
        setEditingTemplateName('');
        setEditingColumns([]);
        setError(null);
    };

    const saveTemplateChanges = async () => {
        if (!selectedTemplate || !editingTemplateName.trim() || editingColumns.length === 0) return;

        try {
            setIsSavingTemplate(true);
            setError(null);

            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/templates/${selectedTemplate.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                    },
                    credentials: 'omit',
                    body: JSON.stringify({
                        name: editingTemplateName,
                        columns: editingColumns
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();

                // Update the selected template and refresh the templates list
                await fetchTemplates();
                setSelectedTemplate(data.template);

                // Exit editing mode
                setIsEditingTemplate(false);
                setEditingTemplateName('');
                setEditingColumns([]);

                // Show success message
                setShowSuccessMessage({
                    show: true,
                    templateName: data.template.name,
                    recordCount: 0
                });
                setTimeout(() => {
                    setShowSuccessMessage({ show: false, templateName: '', recordCount: 0 });
                }, 3000);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to update template');
            }
        } catch (err) {
            console.error('Error updating template:', err);
            setError('Failed to update template');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const updateEditingColumn = (index: number, field: keyof PersonalizationColumn, value: string) => {
        const updated = [...editingColumns];
        updated[index] = { ...updated[index], [field]: value };
        setEditingColumns(updated);
    };

    const addEditingColumn = () => {
        setEditingColumns([...editingColumns, {
            name: '',
            usage_note: '',
            example: ''
        }]);
    };

    const removeEditingColumn = (index: number) => {
        setEditingColumns(editingColumns.filter((_, i) => i !== index));
    };

    // Function to handle template deletion
    const handleDeleteTemplateClick = (template: PersonalizationTemplate) => {
        setDeleteTemplateConfirmModal(template);
    };

    const deleteTemplate = async () => {
        if (!deleteTemplateConfirmModal) return;

        try {
            setIsLoading(true); // Use a general loading state or a specific one if preferred
            setError(null);

            const response = await fetch(
                `${apiBaseUrl}/brdges/${brdgeId}/personalization/templates/${deleteTemplateConfirmModal.id}`,
                {
                    method: 'DELETE',
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                    credentials: 'omit'
                }
            );

            if (response.ok) {
                await fetchTemplates(); // Refresh the list of templates
                if (selectedTemplate?.id === deleteTemplateConfirmModal.id) {
                    setSelectedTemplate(null);
                    setRecords([]);
                }
                setDeleteTemplateConfirmModal(null); // Close modal
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to delete template');
            }
        } catch (err) {
            console.error('Error deleting template:', err);
            setError('Failed to delete template');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Main section in share tab */}
            <section className="relative bg-white border border-gray-200 hover:border-blue-300 transition-all duration-300 rounded-lg overflow-hidden group p-4 my-4">
                <div className="flex items-center mb-2 relative z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></div>
                    <h3 className="font-medium text-gray-800 text-[13px]">Personalization</h3>
                    <div className="h-[1px] flex-1 ml-2 mr-1 bg-gradient-to-r from-transparent via-blue-200/30 to-transparent"></div>
                </div>

                <div className="space-y-3">
                    <p className="text-[11px] text-gray-600">
                        Create personalized experiences for each viewer with custom data points and unique tracking links.
                    </p>

                    {/* Template Summary */}
                    {templates.length > 0 ? (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Users size={14} className="text-blue-500" />
                                    <span className="text-[12px] font-medium text-gray-800">
                                        {templates.length} template{templates.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <span className="text-[11px] text-gray-600">
                                    {templates.reduce((sum, t) => sum + (t.record_count || 0), 0)} total records
                                </span>
                            </div>

                            {/* Quick template list */}
                            <div className="space-y-1">
                                {templates.slice(0, 2).map(template => (
                                    <div key={template.id} className="text-[11px] text-gray-600 flex items-center justify-between">
                                        <span className="truncate">{template.name}</span>
                                        <span className="text-gray-500">{template.record_count || 0} records</span>
                                    </div>
                                ))}
                                {templates.length > 2 && (
                                    <div className="text-[11px] text-gray-500">
                                        and {templates.length - 2} more...
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                            <FileSpreadsheet size={20} className="mx-auto text-gray-400 mb-2" />
                            <p className="text-[12px] text-gray-600">No personalization configured yet</p>
                        </div>
                    )}

                    {/* Manage Button */}
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full px-4 py-2.5 rounded-lg text-[13px] font-medium
                            transition-all duration-300 transform hover:-translate-y-0.5
                            bg-blue-500 text-white hover:bg-blue-600
                            shadow-sm hover:shadow flex items-center justify-center gap-2"
                    >
                        <Users size={14} />
                        Manage Personalization
                    </button>
                </div>
            </section>

            {/* Modal */}
            {showModal && ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowModal(false);
                        }
                    }}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden mx-4"
                        style={{ maxWidth: '1200px' }}
                        onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Personalization Manager</h2>
                                <p className="text-sm text-gray-600 mt-1">Create personalized experiences with custom data and unique tracking</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex h-[calc(90vh-120px)]">
                            {/* Sidebar */}
                            <div className="w-72 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                                <div className="mb-6">
                                    {/* Primary Option - CSV Upload */}
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Recommended</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedTemplate(null);
                                                setShowCreationForm(true);
                                                setCsvFirstMode(true);
                                                setUploadMode('csv');
                                                setError(null);
                                            }}
                                            className="w-full px-4 py-3 rounded-lg text-sm font-medium
                                                transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 
                                                text-white hover:from-blue-600 hover:to-blue-700
                                                shadow-lg hover:shadow-xl transform hover:-translate-y-0.5
                                                flex items-center justify-center gap-2"
                                        >
                                            <Upload size={16} />
                                            <div className="text-left">
                                                <div className="font-semibold">Upload CSV & Create</div>
                                                <div className="text-xs text-blue-100">AI analyzes your data</div>
                                            </div>
                                        </button>
                                        <p className="text-xs text-gray-500 mt-2 px-1">
                                            Upload your CSV and let AI create intelligent field descriptions automatically
                                        </p>
                                    </div>

                                    {/* Secondary Option - Manual */}
                                    <div className="pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => {
                                                setSelectedTemplate(null);
                                                setShowCreationForm(true);
                                                setCsvFirstMode(false);
                                                setUploadMode('manual');
                                                setError(null);
                                            }}
                                            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium
                                                transition-all duration-300 bg-white text-gray-700 hover:bg-gray-50
                                                border border-gray-200 hover:border-gray-300
                                                flex items-center justify-center gap-2"
                                        >
                                            <Plus size={14} />
                                            Create Manually
                                        </button>
                                        <p className="text-xs text-gray-500 mt-1 px-1">
                                            Build from scratch with your own field descriptions
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Templates</h3>
                                    {templates.map(template => (
                                        <div key={template.id} className={`w-full p-3 rounded-lg text-left transition-all duration-200 group relative ${selectedTemplate?.id === template.id
                                            ? 'bg-white border-blue-300 shadow-sm'
                                            : 'bg-white hover:bg-gray-50'
                                            } border border-gray-200`}>
                                            <button
                                                onClick={() => {
                                                    setSelectedTemplate(template);
                                                    setShowCreationForm(false);
                                                    fetchRecords(template.id!);
                                                }}
                                                className="w-full text-left"
                                            >
                                                <div className="font-medium text-sm text-gray-900">{template.name}</div>
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {template.record_count || 0} records • {template.columns.length} fields
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplateClick(template)}
                                                className="absolute top-1 right-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Delete template"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    {templates.length === 0 && !showCreationForm && (
                                        <div className="text-center py-8 text-gray-500 text-sm">
                                            No templates yet
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                {showCreationForm ? (
                                    // Create Template View
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                                {csvFirstMode ? 'Create Template from CSV' : 'Create New Template'}
                                            </h3>

                                            {csvFirstMode ? (
                                                // CSV-First Workflow
                                                <div className="space-y-6">
                                                    {!csvAnalysis ? (
                                                        // Step 1: CSV Upload & Analysis
                                                        <div className="space-y-6">
                                                            {/* Progress Steps */}
                                                            <div className="flex items-center justify-center">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${!analyzingCsv ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                                                        1
                                                                    </div>
                                                                    <div className={`h-0.5 w-16 ${analyzingCsv ? 'bg-blue-200' : 'bg-gray-200'}`}></div>
                                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${analyzingCsv ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                                        2
                                                                    </div>
                                                                    <div className="h-0.5 w-16 bg-gray-200"></div>
                                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-gray-200 text-gray-500">
                                                                        3
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="text-center">
                                                                <div className="text-sm text-gray-600 mb-1">
                                                                    {analyzingCsv ? 'Step 2: AI Analysis' : 'Step 1: Upload CSV'}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {analyzingCsv ? 'Creating smart field descriptions' : 'Upload • AI Analyze • Review & Create'}
                                                                </div>
                                                            </div>

                                                            <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border-2 border-dashed transition-all duration-300 ${analyzingCsv ? 'border-blue-300 shadow-md' : 'border-blue-200 hover:border-blue-300 hover:shadow-sm'}`}>
                                                                <div className="text-center">
                                                                    {analyzingCsv ? (
                                                                        <>
                                                                            <div className="relative inline-flex items-center justify-center mb-4">
                                                                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                                    <FileSpreadsheet size={20} className="text-blue-600" />
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-lg font-semibold text-blue-700 mb-2">
                                                                                AI is analyzing your data...
                                                                            </div>
                                                                            <p className="text-sm text-blue-600 mb-4">
                                                                                Examining column headers and sample data to create intelligent field descriptions
                                                                            </p>
                                                                            <div className="bg-white/50 rounded-lg p-3 text-xs text-blue-600">
                                                                                ✨ This usually takes 10-15 seconds
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="mb-4">
                                                                                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                                                                                    <Upload size={28} className="text-blue-600" />
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-xl font-semibold text-gray-800 mb-2">
                                                                                Upload your CSV file
                                                                            </div>
                                                                            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                                                                                Our AI will analyze your data and automatically generate smart field descriptions,
                                                                                saving you 15+ minutes of manual work
                                                                            </p>

                                                                            <label className="cursor-pointer">
                                                                                <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                                                                                    <FileSpreadsheet size={18} />
                                                                                    Choose CSV File
                                                                                </div>
                                                                                <input
                                                                                    type="file"
                                                                                    accept=".csv"
                                                                                    onChange={(e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        if (file) analyzeCsvFile(file);
                                                                                    }}
                                                                                    className="hidden"
                                                                                    disabled={analyzingCsv}
                                                                                />
                                                                            </label>

                                                                            <div className="mt-6 text-xs text-gray-500 space-y-1">
                                                                                <div>✓ CSV file with column headers</div>
                                                                                <div>✓ Data rows with your personalization info</div>
                                                                                <div>✓ Fields like name, email, company, etc.</div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Step 2: Review AI Analysis
                                                        <div className="space-y-6">
                                                            {/* Progress Steps - Updated */}
                                                            <div className="flex items-center justify-center">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-green-500 text-white">
                                                                        ✓
                                                                    </div>
                                                                    <div className="h-0.5 w-16 bg-green-300"></div>
                                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-green-500 text-white">
                                                                        ✓
                                                                    </div>
                                                                    <div className="h-0.5 w-16 bg-blue-200"></div>
                                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-blue-500 text-white">
                                                                        3
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="text-center">
                                                                <div className="text-sm text-gray-600 mb-1">Step 3: Review & Create</div>
                                                                <div className="text-xs text-gray-500">AI analysis complete • Review suggestions • Create template</div>
                                                            </div>

                                                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                                                                <div className="flex items-start gap-3 mb-4">
                                                                    <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                                                                        <Check size={20} className="text-green-600" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="text-lg font-semibold text-green-800 mb-1">AI Analysis Complete!</div>
                                                                        <p className="text-sm text-green-700 mb-3">{csvAnalysis.analysis_summary}</p>
                                                                        <div className="bg-white/70 rounded-lg p-3">
                                                                            <div className="text-xs text-green-700 font-medium mb-1">What AI found in your data:</div>
                                                                            <div className="text-xs text-green-600 space-y-1">
                                                                                <div>📊 {csvAnalysis.row_count || 0} data rows detected</div>
                                                                                <div>📝 {(csvAnalysis.columns || []).length} columns analyzed</div>
                                                                                <div>🤖 Smart descriptions generated for each field</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                    Template Name
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={newTemplateName}
                                                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                                                    placeholder="AI suggested name"
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                        focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                />
                                                            </div>

                                                            <div>
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700">
                                                                            Review AI-Generated Field Descriptions
                                                                        </label>
                                                                        <p className="text-xs text-gray-500 mt-1">
                                                                            The AI has analyzed your CSV and created smart descriptions. You can edit them or keep as-is.
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-xs text-blue-600 font-medium">
                                                                        {newColumns.length} fields ready
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-4">
                                                                    {newColumns.map((column, index) => (
                                                                        <div key={index} className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-200 transition-colors">
                                                                            <div className="flex items-start gap-4">
                                                                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-blue-600 font-medium text-sm">
                                                                                    {index + 1}
                                                                                </div>
                                                                                <div className="flex-1 space-y-4">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="text-base font-semibold text-gray-800">{column.name}</div>
                                                                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                                                                            {column.data_type || 'text'}
                                                                                        </span>
                                                                                        {column.confidence && (
                                                                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                                                                                {Math.round(column.confidence * 100)}% confident
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="grid md:grid-cols-2 gap-4">
                                                                                        <div>
                                                                                            <label className="text-xs font-medium text-gray-600 mb-2 block">
                                                                                                🤖 How AI Should Use This Field
                                                                                            </label>
                                                                                            <textarea
                                                                                                value={column.usage_note}
                                                                                                onChange={(e) => updateColumn(index, 'usage_note', e.target.value)}
                                                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                                                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                                                                rows={3}
                                                                                                placeholder="Describe how the AI should use this data..."
                                                                                            />
                                                                                        </div>
                                                                                        <div>
                                                                                            <label className="text-xs font-medium text-gray-600 mb-2 block">
                                                                                                📋 Example from Your Data
                                                                                            </label>
                                                                                            <input
                                                                                                type="text"
                                                                                                value={column.example || ''}
                                                                                                onChange={(e) => updateColumn(index, 'example', e.target.value)}
                                                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                                                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                                                                placeholder="Sample value from your CSV..."
                                                                                            />
                                                                                            {column.personalization_potential && (
                                                                                                <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg p-2">
                                                                                                    💡 {column.personalization_potential}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                                                <div className="text-center mb-4">
                                                                    <div className="text-sm font-medium text-gray-700 mb-1">Ready to create your personalization template?</div>
                                                                    <div className="text-xs text-gray-500">This will create the template and import all {csvAnalysis.row_count || 0} records from your CSV</div>
                                                                </div>

                                                                <div className="flex flex-col sm:flex-row gap-3">
                                                                    <button
                                                                        onClick={() => {
                                                                            // Create template and import records in one step
                                                                            if (csvFileForCreation) {
                                                                                createTemplateFromCsv(csvFileForCreation);
                                                                            } else {
                                                                                setError("No CSV file found for creation. Please try uploading again.");
                                                                            }
                                                                        }}
                                                                        disabled={!newTemplateName.trim() || newColumns.length === 0 || isCreating}
                                                                        className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold
                                                            hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                                                            flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl"
                                                                    >
                                                                        {isCreating ? (
                                                                            <>
                                                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                                                                <span>Creating Template & Importing Records...</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Check size={18} />
                                                                                <span>Create Template & Import {csvAnalysis.row_count || 0} Records</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>

                                                                <div className="flex gap-2 mt-3">
                                                                    <button
                                                                        onClick={() => {
                                                                            setCsvAnalysis(null);
                                                                            setCsvFileForCreation(null);
                                                                            setNewTemplateName('');
                                                                            setNewColumns([
                                                                                { name: 'name', usage_note: 'The recipient\'s name', example: 'John Smith' },
                                                                                { name: 'company', usage_note: 'The recipient\'s company', example: 'Acme Corp' }
                                                                            ]);
                                                                        }}
                                                                        disabled={isCreating}
                                                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium
                                                                            text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                                                    >
                                                                        Try Different CSV
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setShowCreationForm(false);
                                                                            setCsvFirstMode(false);
                                                                            setCsvAnalysis(null);
                                                                            setCsvFileForCreation(null);
                                                                            setNewTemplateName('');
                                                                            setNewColumns([
                                                                                { name: 'name', usage_note: 'The recipient\'s name', example: 'John Smith' },
                                                                                { name: 'company', usage_note: 'The recipient\'s company', example: 'Acme Corp' }
                                                                            ]);
                                                                        }}
                                                                        disabled={isCreating}
                                                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium
                                                                            text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                // Manual Template Creation (existing workflow)
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                                            Template Name
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={newTemplateName}
                                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                                            placeholder="e.g., Sales Outreach Q4"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="block text-sm font-medium text-gray-700">
                                                                Data Fields
                                                            </label>
                                                            <button
                                                                onClick={addColumn}
                                                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                            >
                                                                <Plus size={12} />
                                                                Add Field
                                                            </button>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {newColumns.map((column, index) => (
                                                                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="flex-1 space-y-3">
                                                                            <div>
                                                                                <label className="text-xs font-medium text-gray-600">Field Name</label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={column.name}
                                                                                    onChange={(e) => updateColumn(index, 'name', e.target.value)}
                                                                                    placeholder="e.g., company"
                                                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm
                                                                                        focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-xs font-medium text-gray-600">How AI Should Use This</label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={column.usage_note}
                                                                                    onChange={(e) => updateColumn(index, 'usage_note', e.target.value)}
                                                                                    placeholder="e.g., The recipient's company name"
                                                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm
                                                                                        focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-xs font-medium text-gray-600">Example (optional)</label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={column.example || ''}
                                                                                    onChange={(e) => updateColumn(index, 'example', e.target.value)}
                                                                                    placeholder="e.g., Acme Corp"
                                                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm
                                                                                        focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => removeColumn(index)}
                                                                            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                                                                        >
                                                                            <X size={16} className="text-gray-500" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={createTemplate}
                                                            disabled={!newTemplateName.trim() || newColumns.length === 0 || isCreating}
                                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium
                                                hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                                                flex items-center gap-2"
                                                        >
                                                            {isCreating ? (
                                                                <>
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                    Creating...
                                                                </>
                                                            ) : (
                                                                'Create Template'
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowCreationForm(false);
                                                                setCsvFirstMode(false);
                                                                setNewTemplateName('');
                                                                setNewColumns([
                                                                    { name: 'name', usage_note: 'The recipient\'s name', example: 'John Smith' },
                                                                    { name: 'company', usage_note: 'The recipient\'s company', example: 'Acme Corp' }
                                                                ]);
                                                            }}
                                                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium
                                                                text-gray-700 hover:bg-gray-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : selectedTemplate ? (
                                    // View/Edit Template
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            {isEditingTemplate ? (
                                                <div className="flex-1 mr-4">
                                                    <input
                                                        type="text"
                                                        value={editingTemplateName}
                                                        onChange={(e) => setEditingTemplateName(e.target.value)}
                                                        className="text-lg font-medium text-gray-900 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 outline-none w-full"
                                                        placeholder="Template name"
                                                    />
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {selectedTemplate.record_count || 0} personalized records • Editing template
                                                    </p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <h3 className="text-lg font-medium text-gray-900">{selectedTemplate.name}</h3>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {selectedTemplate.record_count || 0} personalized records
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {isEditingTemplate ? (
                                                    <>
                                                        <button
                                                            onClick={saveTemplateChanges}
                                                            disabled={!editingTemplateName.trim() || editingColumns.length === 0 || isSavingTemplate}
                                                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium
                                                                hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                                                                flex items-center gap-2"
                                                        >
                                                            {isSavingTemplate ? (
                                                                <>
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                    Saving...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check size={14} />
                                                                    Save Changes
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={cancelEditingTemplate}
                                                            disabled={isSavingTemplate}
                                                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium
                                                                text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={startEditingTemplate}
                                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium
                                                                text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <Edit2 size={14} />
                                                            Edit Template
                                                        </button>
                                                        {records.length > 0 && (
                                                            <button
                                                                onClick={exportLinks}
                                                                disabled={isExporting}
                                                                className={`px-4 py-2 rounded-lg text-sm font-medium
                                                    flex items-center gap-2 transition-all duration-300
                                                    ${exportSuccess
                                                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                                                        : isExporting
                                                                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                            >
                                                                {isExporting ? (
                                                                    <>
                                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                                        Exporting...
                                                                    </>
                                                                ) : exportSuccess ? (
                                                                    <>
                                                                        <Check size={14} />
                                                                        Exported!
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Download size={14} />
                                                                        Export Links
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Template Column Editing */}
                                        {isEditingTemplate && (
                                            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <h4 className="text-base font-medium text-gray-800">Edit Template Fields</h4>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Modify field names and AI usage instructions. Changes will affect future conversations.
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={addEditingColumn}
                                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                                                            hover:bg-blue-700 flex items-center gap-2"
                                                    >
                                                        <Plus size={14} />
                                                        Add Field
                                                    </button>
                                                </div>

                                                <div className="space-y-4">
                                                    {editingColumns.map((column, index) => (
                                                        <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                                                            <div className="flex items-start gap-4">
                                                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-blue-600 font-medium text-sm">
                                                                    {index + 1}
                                                                </div>
                                                                <div className="flex-1 space-y-4">
                                                                    <div className="grid md:grid-cols-2 gap-4">
                                                                        <div>
                                                                            <label className="text-xs font-medium text-gray-600 mb-2 block">
                                                                                Field Name
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                value={column.name}
                                                                                onChange={(e) => updateEditingColumn(index, 'name', e.target.value)}
                                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                                placeholder="e.g., company"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-medium text-gray-600 mb-2 block">
                                                                                Example Value
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                value={column.example || ''}
                                                                                onChange={(e) => updateEditingColumn(index, 'example', e.target.value)}
                                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                                placeholder="e.g., Acme Corp"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-medium text-gray-600 mb-2 block">
                                                                            🤖 How AI Should Use This Field
                                                                        </label>
                                                                        <textarea
                                                                            value={column.usage_note}
                                                                            onChange={(e) => updateEditingColumn(index, 'usage_note', e.target.value)}
                                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                                focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                            rows={2}
                                                                            placeholder="Describe how the AI should use this data in conversations..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {editingColumns.length > 1 && (
                                                                    <button
                                                                        onClick={() => removeEditingColumn(index)}
                                                                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                                        title="Remove this field"
                                                                    >
                                                                        <X size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {editingColumns.length === 0 && (
                                                    <div className="text-center py-6 text-gray-500">
                                                        <p className="text-sm">No fields defined. Add at least one field to continue.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Upload Mode Toggle */}
                                        {!isEditingTemplate && (
                                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                                <button
                                                    onClick={() => setUploadMode('manual')}
                                                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${uploadMode === 'manual'
                                                        ? 'bg-white text-blue-600 shadow-sm'
                                                        : 'text-gray-600 hover:text-gray-800'
                                                        }`}
                                                >
                                                    Manual Entry
                                                </button>
                                                <button
                                                    onClick={() => setUploadMode('csv')}
                                                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${uploadMode === 'csv'
                                                        ? 'bg-white text-blue-600 shadow-sm'
                                                        : 'text-gray-600 hover:text-gray-800'
                                                        }`}
                                                >
                                                    CSV Upload
                                                </button>
                                            </div>
                                        )}

                                        {/* Upload/Entry Section */}
                                        {!isEditingTemplate && uploadMode === 'csv' ? (
                                            <div className={`bg-gray-50 rounded-lg p-6 border-2 border-dashed transition-all duration-200 ${isUploading
                                                ? 'border-blue-300 bg-blue-50'
                                                : 'border-gray-300'
                                                }`}>
                                                <div className="text-center">
                                                    {isUploading ? (
                                                        <>
                                                            <div className="inline-flex items-center justify-center">
                                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                                                            </div>
                                                            <div className="text-sm font-medium text-blue-600 mb-2">
                                                                Uploading and processing CSV...
                                                            </div>
                                                            <p className="text-xs text-blue-600">
                                                                Please wait while we create your personalization records
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                                                            <label className="cursor-pointer">
                                                                <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                                                    Click to upload CSV
                                                                </span>
                                                                <input
                                                                    type="file"
                                                                    accept=".csv"
                                                                    onChange={handleFileUpload}
                                                                    className="hidden"
                                                                    disabled={isUploading}
                                                                />
                                                            </label>
                                                            <p className="text-xs text-gray-600 mt-2">
                                                                CSV should include columns: {selectedTemplate.columns.map(c => c.name).join(', ')}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ) : !isEditingTemplate ? (
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <div className="space-y-3">
                                                    {selectedTemplate.columns.map(column => (
                                                        <div key={column.name}>
                                                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                                                {column.name}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={manualRecord[column.name] || ''}
                                                                onChange={(e) => setManualRecord({
                                                                    ...manualRecord,
                                                                    [column.name]: e.target.value
                                                                })}
                                                                placeholder={column.example || `Enter ${column.name}`}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                                                    focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                            <p className="text-xs text-gray-500 mt-1">{column.usage_note}</p>
                                                        </div>
                                                    ))}

                                                    <button
                                                        onClick={createManualRecord}
                                                        disabled={Object.keys(manualRecord).length === 0 || isCreatingRecord}
                                                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium
                                            hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                                            flex items-center justify-center gap-2"
                                                    >
                                                        {isCreatingRecord ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                Creating...
                                                            </>
                                                        ) : (
                                                            'Add Record'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* Records List */}
                                        {records.length > 0 && (
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-sm font-medium text-gray-700">Records</h4>
                                                    {selectedRecords.size > 0 && (
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-gray-600">
                                                                {selectedRecords.size} selected
                                                            </span>
                                                            <button
                                                                onClick={handleBulkDeleteClick}
                                                                disabled={isBulkDeleting}
                                                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium
                                                    hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                                                    flex items-center gap-2"
                                                            >
                                                                {isBulkDeleting ? (
                                                                    <>
                                                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                                        Deleting...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Trash2 size={12} />
                                                                        Delete Selected
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 border-b border-gray-200">
                                                            <tr>
                                                                <th className="text-left px-4 py-2 font-medium text-gray-700 w-12">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={records.length > 0 && selectedRecords.size === records.length}
                                                                        onChange={toggleSelectAll}
                                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                </th>
                                                                {selectedTemplate.columns.map(column => (
                                                                    <th key={column.name} className="text-left px-4 py-2 font-medium text-gray-700">
                                                                        {column.name}
                                                                    </th>
                                                                ))}
                                                                <th className="text-left px-4 py-2 font-medium text-gray-700">Link</th>
                                                                <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {records.map(record => (
                                                                <tr key={record.unique_id} className="hover:bg-gray-50">
                                                                    <td className="px-4 py-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedRecords.has(record.id)}
                                                                            onChange={() => toggleRecordSelection(record.id)}
                                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                        />
                                                                    </td>
                                                                    {selectedTemplate.columns.map(column => (
                                                                        <td key={column.name} className="px-4 py-2 text-gray-800">
                                                                            {record.data[column.name] || '-'}
                                                                        </td>
                                                                    ))}
                                                                    <td className="px-4 py-2">
                                                                        <button
                                                                            onClick={() => copyPersonalizedLink(record.unique_id)}
                                                                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                                        >
                                                                            {copiedLinks.has(record.unique_id) ? (
                                                                                <>
                                                                                    <Check size={12} />
                                                                                    <span className="text-xs">Copied!</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Copy size={12} />
                                                                                    <span className="text-xs">Copy Link</span>
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right">
                                                                        <button
                                                                            onClick={() => handleDeleteClick(record.id, record.data)}
                                                                            className="text-red-600 hover:text-red-700 p-1"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Success Message */}
                                        {showSuccessMessage.show && (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                                                    <Check size={16} className="text-green-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-green-800 mb-1">
                                                        Template Created Successfully! 🎉
                                                    </div>
                                                    <div className="text-sm text-green-700">
                                                        Created &ldquo;{showSuccessMessage.templateName}&rdquo; with {showSuccessMessage.recordCount} personalized records.
                                                        Your personalization links are ready to use!
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Error Message */}
                                        {error && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                                <AlertCircle size={14} className="text-red-600 mt-0.5" />
                                                <div className="text-sm text-red-700">{error}</div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // No selection
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <div className="text-center">
                                            <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-3" />
                                            <p className="text-sm">Select a template or create a new one</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Link Copy Modal - for when clipboard is blocked */}
            {showLinkModal && ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30"
                    onClick={() => setShowLinkModal(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl p-4 mx-4 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Copy Personalized Link</h3>
                        <p className="text-xs text-gray-600 mb-3">
                            Select and copy this link manually:
                        </p>
                        <input
                            type="text"
                            value={showLinkModal.link}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 select-all"
                            onFocus={(e) => e.target.select()}
                            autoFocus
                        />
                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={() => setShowLinkModal(null)}
                                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmModal && ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setDeleteConfirmModal(null)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-xl shadow-2xl p-6 mx-4 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <Trash2 size={24} className="text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Record</h3>
                            </div>

                            <p className="text-sm text-gray-600 mb-4">
                                Are you sure you want to delete this personalization record?
                            </p>

                            {/* Show record preview */}
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div className="space-y-1">
                                    {Object.entries(deleteConfirmModal.recordData).slice(0, 3).map(([key, value]) => (
                                        <div key={key} className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-500 capitalize">{key}:</span>
                                            <span className="text-gray-800 font-medium truncate">{String(value)}</span>
                                        </div>
                                    ))}
                                    {Object.keys(deleteConfirmModal.recordData).length > 3 && (
                                        <div className="text-xs text-gray-500">
                                            ...and {Object.keys(deleteConfirmModal.recordData).length - 3} more fields
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-800">
                                        This action cannot be undone. The personalized link for this record will no longer work.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmModal(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium
                                    text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteRecord(deleteConfirmModal.recordId)}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium
                                    hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} />
                                Delete Record
                            </button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}

            {/* Bulk Delete Confirmation Modal */}
            {bulkDeleteConfirmModal && ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setBulkDeleteConfirmModal(null)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-xl shadow-2xl p-6 mx-4 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <Trash2 size={24} className="text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Multiple Records</h3>
                            </div>

                            <p className="text-sm text-gray-600 mb-4">
                                Are you sure you want to delete <strong>{bulkDeleteConfirmModal.recordCount}</strong> personalization {bulkDeleteConfirmModal.recordCount === 1 ? 'record' : 'records'}?
                            </p>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-800">
                                        This action cannot be undone. All personalized links for these records will no longer work.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setBulkDeleteConfirmModal(null)}
                                disabled={isBulkDeleting}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium
                                    text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={bulkDeleteRecords}
                                disabled={isBulkDeleting}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium
                                    hover:bg-red-700 transition-colors flex items-center justify-center gap-2
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isBulkDeleting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        Delete {bulkDeleteConfirmModal.recordCount} {bulkDeleteConfirmModal.recordCount === 1 ? 'Record' : 'Records'}
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}

            {/* Delete Template Confirmation Modal */}
            {deleteTemplateConfirmModal && ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setDeleteTemplateConfirmModal(null)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-xl shadow-2xl p-6 mx-4 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <Trash2 size={24} className="text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Template</h3>
                            </div>

                            <p className="text-sm text-gray-600 mb-4">
                                Are you sure you want to delete the template &ldquo;
                                <strong className="text-red-700">{deleteTemplateConfirmModal.name}&rdquo;</strong>?
                                This will also remove all {deleteTemplateConfirmModal.record_count || 0} associated records.
                            </p>

                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-800">
                                        This action cannot be undone. Personalized links associated with these records will no longer work.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTemplateConfirmModal(null)}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium
                                    text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteTemplate}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium
                                    hover:bg-red-700 transition-colors flex items-center justify-center gap-2
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        Delete Template
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}
        </>
    );
}; 