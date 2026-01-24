/**
 * Field Panel Component
 * 
 * Right-side panel for managing signature fields on the PDF.
 * Zoho Sign-style field management interface with all field types.
 */

import React from 'react';
import { SignatureField } from '../../lib/signatureFieldApi';
import { StatusBadge } from '../ui';

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
}) => {
  // Define all field types (matching Zoho Sign)
  const fieldTypes: FieldType[] = [
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
      id: 'date',
      label: 'Sign Date',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Panel Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Fields</h2>
        <p className="text-xs text-gray-500 mt-1">
          {fields.length} field{fields.length !== 1 ? 's' : ''} placed
        </p>
      </div>

      {/* Field Types Grid */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Field</h3>
        <div className="grid grid-cols-2 gap-2">
          {fieldTypes.map((type) => {
            const isActive = isPlacingField && fieldType === type.id;
            const isDisabled = disabled || type.disabled;
            
            return (
              <button
                key={type.id}
                onClick={() => {
                  if (isActive) {
                    onCancelPlacement();
                  } else if (!isDisabled) {
                    onStartPlacement(type.id);
                  }
                }}
                disabled={isDisabled}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-lg border transition-all
                  ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : isDisabled
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
                  }
                `}
                title={type.disabled ? 'Coming soon' : type.label}
              >
                <span className={isDisabled ? 'opacity-50' : ''}>{type.icon}</span>
                <span className="text-xs font-medium text-center">{type.label}</span>
                {type.disabled && (
                  <span className="text-[10px] text-gray-400">Soon</span>
                )}
              </button>
            );
          })}
        </div>

        {isPlacingField && (
          <p className="text-xs text-gray-600 mt-3 p-2 bg-blue-50 rounded border border-blue-200">
            Click and drag on the PDF to place a <strong>{fieldTypes.find(t => t.id === fieldType)?.label || 'field'}</strong>
          </p>
        )}
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto">
        {fields.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-8 w-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No fields placed yet</p>
            <p className="text-xs text-gray-400 mt-1">Select a field type above to start</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Placed Fields</h3>
            {sortedPages.map((pageNumber) => (
              <div key={pageNumber}>
                <h4 className="text-xs font-medium text-gray-600 mb-2">
                  Page {pageNumber}
                </h4>
                <div className="space-y-2">
                  {fieldsByPage[pageNumber].map((field) => (
                    <div
                      key={field.id}
                      onClick={() => onFieldSelect?.(field.id)}
                      className={`
                        p-3 rounded-lg border transition-colors cursor-pointer
                        ${
                          selectedFieldId === field.id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={field.status} size="sm" />
                          </div>
                          <p className="text-xs text-gray-600">
                            Position: {field.x.toFixed(0)}, {field.y.toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-600">
                            Size: {field.width.toFixed(0)} × {field.height.toFixed(0)}
                          </p>
                        </div>
                        {field.status === 'PENDING' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteField(field.id);
                            }}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Delete field"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
