/**
 * Field Panel Component
 * 
 * Right-side panel for managing signature fields on the PDF.
 * Zoho Sign-style: recipients first (Me + Signer 1, 2, ...), then field types.
 */

import React from 'react';
import { SignatureField } from '../../lib/signatureFieldApi';
import { getRecipientColor } from '../../utils/recipientColors';

interface FieldPanelProps {
  fields: SignatureField[];
  isPlacingField: boolean;
  fieldType?: string | null; // Current field type being placed
  onStartPlacement: (fieldType: string) => void;
  onCancelPlacement: () => void;
  onDeleteField: (fieldId: string) => void;
  onFieldSelect?: (fieldId: string) => void;
  selectedFieldId?: string | null;
  disabled?: boolean;
  fieldRoles?: Record<string, string>; // Map of fieldId -> role (Me | Signer 1 | Signer 2 | ...)
  onRoleChange?: (fieldId: string, role: string) => void;
  /** Zoho-style: list of recipients (Me, Signer 1, Signer 2, ...) shown above field types */
  recipients?: string[];
  /** Optional email per recipient for display (e.g. "Signer 1 - email@x.com") */
  recipientEmails?: Record<string, string>;
  /** Currently selected recipient for new fields */
  selectedRecipient?: string;
  onSelectRecipient?: (recipient: string) => void;
  onAddRecipient?: () => void;
  onRemoveRecipient?: (recipient: string) => void;
}

interface FieldType {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

/**
 * FieldPanel - Right-side field management panel
 */
export const FieldPanel: React.FC<FieldPanelProps> = ({
  fields,
  isPlacingField,
  fieldType,
  onStartPlacement,
  onCancelPlacement,
  onDeleteField,
  onFieldSelect,
  selectedFieldId,
  disabled = false,
  fieldRoles = {},
  onRoleChange,
  recipients = ['Me', 'Signer 1'],
  recipientEmails = {},
  selectedRecipient = 'Signer 1',
  onSelectRecipient,
  onAddRecipient,
  onRemoveRecipient,
}) => {
  const isMeSelected = selectedRecipient === 'Me';

  const getRecipientLabel = (role: string) => {
    const email = recipientEmails[role]?.trim();
    if (role === 'Me') return email ? `Prefill by you (${email})` : 'Prefill by you';
    return email ? `${role} ${email}` : role;
  };
  const getInitial = (role: string) =>
    role === 'Me' ? 'P' : (role.match(/Signer (\d+)/)?.[1] ?? role).charAt(0);

  // Standard and Custom field types (Zoho-style)
  const allFieldTypes: FieldType[] = [
    {
      id: 'signature',
      label: 'Signature',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    },
    {
      id: 'initial',
      label: 'Initial',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'fullname',
      label: 'Full name',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'text',
      label: 'Text',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      ),
    },
    {
      id: 'datepicker',
      label: 'Date',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'company',
      label: 'Company',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'checkbox',
      label: 'Checkbox',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      disabled: true,
    },
    {
      id: 'dropdown',
      label: 'Dropdown',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      ),
      disabled: true,
    },
  ];
  const standardFieldIds = ['signature', 'initial', 'fullname', 'email', 'datepicker', 'company', 'text'];
  const standardFieldTypes = allFieldTypes.filter((t) => standardFieldIds.includes(t.id));
  const customFieldTypes = allFieldTypes.filter((t) => !standardFieldIds.includes(t.id));

  // Zoho-style: symbol (icon) on left, name on right — single row per field type
  const renderFieldTypeRow = (type: FieldType) => {
    const isActive = isPlacingField && fieldType === type.id;
    const signatureDisabledForMe = type.id === 'signature' && isMeSelected;
    const isDisabled = disabled || type.disabled || signatureDisabledForMe;
    return (
      <button
        key={type.id}
        type="button"
        onClick={() => {
          if (isActive) onCancelPlacement();
          else if (!isDisabled) onStartPlacement(type.id);
        }}
        disabled={isDisabled}
        title={type.disabled ? 'Coming soon' : signatureDisabledForMe ? 'Signature not available for Me' : type.label}
        className={`
          w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-left transition-all
          ${isActive ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : isDisabled ? 'border-transparent bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-transparent bg-white text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'}
        `}
      >
        <span className={`shrink-0 inline-flex text-gray-500 [&_svg]:w-4 [&_svg]:h-4 ${isActive ? 'text-indigo-600' : ''} ${isDisabled ? 'opacity-50' : ''}`}>{type.icon}</span>
        <span className="flex-1 text-xs font-medium">{type.label}</span>
        {type.disabled && <span className="text-[9px] text-gray-400 shrink-0">Soon</span>}
      </button>
    );
  };

  // Group fields by page
  const fieldsByPage = fields.reduce((acc, field) => {
    if (!acc[field.page_number]) {
      acc[field.page_number] = [];
    }
    acc[field.page_number].push(field);
    return acc;
  }, {} as Record<number, SignatureField[]>);

  const sortedPages = Object.keys(fieldsByPage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full min-h-0 shrink-0">
      {/* Panel Header — compact */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Fields</h2>
        <p className="text-[11px] text-gray-500">{fields.length} field{fields.length !== 1 ? 's' : ''} placed</p>
      </div>

      {/* Recipients — compact */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-200">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Recipients</h3>
        <div className="space-y-0.5">
          {recipients.map((recipient) => {
            const isSelected = selectedRecipient === recipient;
            const initial = getInitial(recipient);
            const label = getRecipientLabel(recipient);
            const color = getRecipientColor(recipient);
            const canRemove = recipient !== 'Me' && recipients.length > 1 && onRemoveRecipient;
            // Count fields assigned to this recipient: check fieldRoles first, then field.role property
            const fieldsForRecipient = fields.filter((f) => {
              const fieldRole = fieldRoles[f.id] || (f as any).role || selectedRecipient;
              return fieldRole === recipient;
            });
            const hasFields = fieldsForRecipient.length > 0;
            return (
              <div
                key={recipient}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all border-l-4 group
                  ${isSelected ? 'hover:bg-gray-50' : 'border-transparent hover:bg-gray-50 text-gray-700'}
                  ${disabled ? 'opacity-60' : ''}
                `}
                style={{
                  borderLeftColor: color.border,
                  ...(isSelected ? { backgroundColor: color.bgLight, color: color.text } : {}),
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectRecipient?.(recipient)}
                  disabled={disabled}
                  className="flex-1 flex items-center gap-2 min-w-0"
                >
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                    style={{ backgroundColor: isSelected ? color.border : color.bg }}
                  >
                    {initial}
                  </span>
                  <span className="flex-1 min-w-0 text-xs font-medium truncate" title={label} style={isSelected ? { color: color.text } : undefined}>{label}</span>
                </button>
                {canRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasFields && !window.confirm(`Remove "${recipient}" and delete all ${fieldsForRecipient.length} field${fieldsForRecipient.length !== 1 ? 's' : ''} assigned to them?`)) {
                        return;
                      }
                      onRemoveRecipient(recipient);
                    }}
                    disabled={disabled}
                    className="shrink-0 p-1 text-gray-400 hover:text-red-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title={`Remove ${recipient}${hasFields ? ` and ${fieldsForRecipient.length} field${fieldsForRecipient.length !== 1 ? 's' : ''}` : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          {onAddRecipient && (
            <button
              type="button"
              onClick={onAddRecipient}
              disabled={disabled || recipients.length >= 10}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 text-xs font-medium transition-all disabled:opacity-50"
              title="Add recipient"
            >
              <span className="shrink-0 w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">+</span>
              Add recipient
            </button>
          )}
        </div>
      </div>

      {/* Field types — Zoho-style: symbol left, name right (list of rows) */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-200">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Add field</h3>
        <div className="space-y-0.5">
          {standardFieldTypes.map(renderFieldTypeRow)}
          {customFieldTypes.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-2 mb-1">Custom</div>
              {customFieldTypes.map(renderFieldTypeRow)}
            </>
          )}
        </div>
        {isPlacingField && (
          <p className="text-[10px] text-indigo-600 mt-1.5 px-2 py-1 bg-indigo-50 rounded">
            Drag on PDF to place <strong>{allFieldTypes.find((t) => t.id === fieldType)?.label ?? 'field'}</strong>
          </p>
        )}
      </div>

      {/* Placed fields — grouped by recipient/signer, internal scroll only if many */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {fields.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500">No fields placed yet</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Select a field type above</p>
          </div>
        ) : (
          <div className="px-3 py-2 space-y-3">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Placed Fields</h3>
            {/* Group fields by recipient */}
            {recipients.map((recipient) => {
              // Get all fields assigned to this recipient
              const recipientFields = fields.filter((field) => {
                const fieldRole = fieldRoles[field.id] || (field as any).role || selectedRecipient;
                return fieldRole === recipient;
              });

              if (recipientFields.length === 0) return null;

              const initial = getInitial(recipient);
              const label = getRecipientLabel(recipient);
              const color = getRecipientColor(recipient);

              return (
                <div key={recipient} className="space-y-1.5">
                  {/* Recipient header - same color as fields on PDF */}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                      style={{ backgroundColor: color.border }}
                    >
                      {initial}
                    </span>
                    <span className="flex-1 text-[10px] font-semibold text-gray-700">{label}</span>
                    <span className="text-[9px] text-gray-400">{recipientFields.length} field{recipientFields.length !== 1 ? 's' : ''}</span>
                  </div>
                  
                  {/* Fields for this recipient */}
                  <div className="space-y-1 pl-7">
                    {recipientFields.map((field) => {
                      const fieldRole = fieldRoles[field.id] || (field as any).role || recipient;
                      const rawType = field.field_type?.toLowerCase() || field.signature_type || 'signature';
                      const fieldTypeId = rawType === 'date' ? 'datepicker' : rawType;
                      const fieldTypeIcon = allFieldTypes.find((t: FieldType) => t.id === fieldTypeId)?.icon || allFieldTypes[0].icon;
                      const fieldTypeLabel = allFieldTypes.find((t: FieldType) => t.id === fieldTypeId)?.label || 'Signature';
                      
                      return (
                        <div
                          key={field.id}
                          onClick={() => onFieldSelect?.(field.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors cursor-pointer text-left group ${
                            selectedFieldId === field.id 
                              ? 'border-indigo-500 bg-indigo-50' 
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="shrink-0 text-gray-500 [&_svg]:w-3.5 [&_svg]:h-3.5">{fieldTypeIcon}</span>
                          <span className="text-[10px] text-gray-500 shrink-0">P{field.page_number}</span>
                          <select
                            value={recipients.includes(fieldRole) ? fieldRole : recipients[0]}
                            onChange={(e) => { 
                              e.stopPropagation(); 
                              onRoleChange?.(field.id, e.target.value); 
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-[10px] border-0 bg-transparent py-0 pr-5 focus:ring-0 text-gray-700"
                            disabled={disabled || field.status === 'SIGNED'}
                          >
                            {recipients.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {field.status === 'PENDING' && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                onDeleteField(field.id); 
                              }} 
                              className="shrink-0 p-0.5 text-red-500 hover:text-red-600 rounded transition-colors" 
                              title="Delete field"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {/* Show fields without assigned recipient (fallback) */}
            {(() => {
              const unassignedFields = fields.filter((field) => {
                const fieldRole = fieldRoles[field.id] || (field as any).role;
                return !fieldRole || !recipients.includes(fieldRole);
              });

              if (unassignedFields.length === 0) return null;

              return (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="text-[10px] font-semibold text-gray-500">Unassigned</span>
                    <span className="text-[9px] text-gray-400">{unassignedFields.length} field{unassignedFields.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-1 pl-7">
                    {unassignedFields.map((field) => {
                      const fieldRole = fieldRoles[field.id] || (field as any).role || recipients[0] || 'Signer 1';
                      const rawType = field.field_type?.toLowerCase() || field.signature_type || 'signature';
                      const fieldTypeId = rawType === 'date' ? 'datepicker' : rawType;
                      const fieldTypeIcon = allFieldTypes.find((t: FieldType) => t.id === fieldTypeId)?.icon || allFieldTypes[0].icon;
                      
                      return (
                        <div
                          key={field.id}
                          onClick={() => onFieldSelect?.(field.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors cursor-pointer text-left group ${
                            selectedFieldId === field.id 
                              ? 'border-indigo-500 bg-indigo-50' 
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="shrink-0 text-gray-500 [&_svg]:w-3.5 [&_svg]:h-3.5">{fieldTypeIcon}</span>
                          <span className="text-[10px] text-gray-500 shrink-0">P{field.page_number}</span>
                          <select
                            value={recipients.includes(fieldRole) ? fieldRole : recipients[0]}
                            onChange={(e) => { 
                              e.stopPropagation(); 
                              onRoleChange?.(field.id, e.target.value); 
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-[10px] border-0 bg-transparent py-0 pr-5 focus:ring-0 text-gray-700"
                            disabled={disabled || field.status === 'SIGNED'}
                          >
                            {recipients.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {field.status === 'PENDING' && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                onDeleteField(field.id); 
                              }} 
                              className="shrink-0 p-0.5 text-red-500 hover:text-red-600 rounded transition-colors" 
                              title="Delete field"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Field Properties/Editing Section — shown when field is selected */}
      {selectedFieldId && (() => {
        const selectedField = fields.find((f) => f.id === selectedFieldId);
        if (!selectedField) return null;
        
        const fieldRole = fieldRoles[selectedField.id] || (selectedField as any).role || recipients[0] || 'Signer 1';
        const rawType = selectedField.field_type?.toLowerCase() || selectedField.signature_type || 'signature';
        const fieldTypeId = rawType === 'date' ? 'datepicker' : rawType;
        const fieldTypeLabel = allFieldTypes.find((t: FieldType) => t.id === fieldTypeId)?.label || 'Signature';
        
        return (
          <div className="shrink-0 border-t border-gray-200 bg-gray-50">
            <div className="px-3 py-2">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Field Properties</h3>
              <div className="space-y-2">
                {/* Field Type */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Type</label>
                  <div className="text-xs text-gray-900 bg-white px-2 py-1.5 rounded border border-gray-200">
                    {fieldTypeLabel}
                  </div>
                </div>
                
                {/* Assigned Recipient */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Assigned to</label>
                  <select
                    value={recipients.includes(fieldRole) ? fieldRole : recipients[0]}
                    onChange={(e) => onRoleChange?.(selectedField.id, e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={disabled || selectedField.status === 'SIGNED'}
                  >
                    {recipients.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                
                {/* Position and Size */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">X</label>
                    <div className="text-xs text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200">
                      {Math.round(selectedField.x)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Y</label>
                    <div className="text-xs text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200">
                      {Math.round(selectedField.y)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Width</label>
                    <div className="text-xs text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200">
                      {Math.round(selectedField.width)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Height</label>
                    <div className="text-xs text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200">
                      {Math.round(selectedField.height)}
                    </div>
                  </div>
                </div>
                
                {/* Page */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Page</label>
                  <div className="text-xs text-gray-900 bg-white px-2 py-1.5 rounded border border-gray-200">
                    Page {selectedField.page_number}
                  </div>
                </div>
                
                {/* Status */}
                {selectedField.status && (
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Status</label>
                    <div className={`text-xs px-2 py-1.5 rounded border ${
                      selectedField.status === 'SIGNED' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}>
                      {selectedField.status}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
