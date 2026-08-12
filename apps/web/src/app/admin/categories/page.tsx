'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  createCategory,
  createCategoryAttribute,
  deleteCategory,
  getAdminCategoryTree,
  getCategoryAttributes,
  updateCategory,
  updateCategoryAttribute,
  type Category,
  type CategoryAttribute,
} from '@/lib/api';
import { Badge, Button, Dropdown, Form, Input, LoadingState, Modal, Tabs } from '@/components/ui';

type AttributeDataType = CategoryAttribute['dataType'];

const DATA_TYPE_OPTIONS: { value: AttributeDataType; label: string }[] = [
  { value: 'string', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Так/Ні' },
  { value: 'enum', label: 'Список (одне значення)' },
  { value: 'multi_enum', label: 'Список (кілька значень)' },
  { value: 'range', label: 'Діапазон' },
];

interface CategoryFormState {
  nameUk: string;
  slug: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
  parentId: string | null;
}

const EMPTY_FORM: CategoryFormState = { nameUk: '', slug: '', icon: '', sortOrder: '0', isActive: true, parentId: null };

const ROOT_PARENT_VALUE = 'ROOT';

/**
 * Плаский список для вибору батьківської категорії — при редагуванні виключає саму
 * категорію та все її піддерево (клієнтський UX-guard; реальна перевірка циклів —
 * `CategoriesService.assertNoCycle()` на бекенді).
 */
function flattenForParentPicker(nodes: Category[], excludeId: string | null, depth = 0): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = [];
  for (const node of nodes) {
    if (node.id === excludeId) continue;
    result.push({ value: node.id, label: `${'— '.repeat(depth)}${node.nameUk}` });
    result.push(...flattenForParentPicker(node.children, excludeId, depth + 1));
  }
  return result;
}

interface NewAttrState {
  key: string;
  labelUk: string;
  dataType: AttributeDataType;
  isRequired: boolean;
  isFilterable: boolean;
}

const EMPTY_ATTR: NewAttrState = { key: '', labelUk: '', dataType: 'string', isRequired: false, isFilterable: false };

interface AttrEdit {
  labelUk: string;
  isRequired: boolean;
  isFilterable: boolean;
}

function CategoryNode({
  node,
  depth,
  onEdit,
  onAddChild,
}: {
  node: Category;
  depth: number;
  onEdit: (c: Category) => void;
  onAddChild: (parentId: string) => void;
}) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2" style={{ paddingLeft: depth * 20 }}>
        <span className={node.isActive ? 'font-medium text-gray-900' : 'text-gray-400 line-through'}>{node.nameUk}</span>
        <span className="text-xs text-gray-400">/{node.slug}</span>
        {!node.isActive && <Badge tone="neutral">Неактивна</Badge>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onAddChild(node.id)}>
            + Підкатегорія
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onEdit(node)}>
            Редагувати
          </Button>
        </div>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <CategoryNode key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onAddChild={onAddChild} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AdminCategoriesPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [tree, setTree] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [attrEdits, setAttrEdits] = useState<Record<string, AttrEdit>>({});
  const [savingAttrId, setSavingAttrId] = useState<string | null>(null);
  const [newAttr, setNewAttr] = useState<NewAttrState>(EMPTY_ATTR);
  const [isAddingAttr, setIsAddingAttr] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAdminCategoryTree(accessToken);
      setTree(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити категорії.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && isAdmin) {
      load();
    }
  }, [accessToken, isAdmin, load]);

  async function loadAttributes(categoryId: string) {
    try {
      const result = await getCategoryAttributes(categoryId);
      setAttributes(result);
      setAttrEdits(
        Object.fromEntries(
          result.map((a) => [a.id, { labelUk: a.labelUk, isRequired: a.isRequired, isFilterable: a.isFilterable }]),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити атрибути.');
    }
  }

  function openCreate(parentId: string | null) {
    setModalMode('create');
    setEditingCategory(null);
    setForm({ ...EMPTY_FORM, parentId });
    setAttributes([]);
    setNewAttr(EMPTY_ATTR);
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setModalMode('edit');
    setEditingCategory(category);
    setForm({
      nameUk: category.nameUk,
      slug: category.slug,
      icon: category.icon ?? '',
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
      parentId: category.parentId,
    });
    setNewAttr(EMPTY_ATTR);
    setModalOpen(true);
    loadAttributes(category.id);
  }

  async function handleSaveCategory(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setIsSaving(true);
    setError(null);
    try {
      const dto = {
        nameUk: form.nameUk,
        slug: form.slug,
        icon: form.icon || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        parentId: form.parentId,
      };
      if (modalMode === 'create') {
        await createCategory(dto, accessToken);
      } else if (editingCategory) {
        await updateCategory(editingCategory.id, dto, accessToken);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти категорію.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCategory() {
    if (!accessToken || !editingCategory) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteCategory(editingCategory.id, accessToken);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося видалити категорію.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddAttribute(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !editingCategory) return;
    setIsAddingAttr(true);
    setError(null);
    try {
      await createCategoryAttribute(
        editingCategory.id,
        {
          key: newAttr.key,
          labelUk: newAttr.labelUk,
          dataType: newAttr.dataType,
          isRequired: newAttr.isRequired,
          isFilterable: newAttr.isFilterable,
        },
        accessToken,
      );
      setNewAttr(EMPTY_ATTR);
      await loadAttributes(editingCategory.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося додати атрибут.');
    } finally {
      setIsAddingAttr(false);
    }
  }

  async function handleSaveAttribute(attrId: string) {
    if (!accessToken) return;
    const edit = attrEdits[attrId];
    if (!edit) return;
    setSavingAttrId(attrId);
    setError(null);
    try {
      await updateCategoryAttribute(attrId, edit, accessToken);
      if (editingCategory) await loadAttributes(editingCategory.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти атрибут.');
    } finally {
      setSavingAttrId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700">Щоб керувати категоріями, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  if (!authLoading && user && !isAdmin) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700">Доступ лише для адміністраторів.</div>;
  }

  const parentOptions = [
    { value: ROOT_PARENT_VALUE, label: '— (коренева категорія)' },
    ...flattenForParentPicker(tree, modalMode === 'edit' ? (editingCategory?.id ?? null) : null),
  ];

  const categoryFields = (
    <>
      <Input label="Назва (укр.)" value={form.nameUk} onChange={(e) => setForm((f) => ({ ...f, nameUk: e.target.value }))} />
      <Input label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
      <Input label="Іконка" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
      <Dropdown
        label="Батьківська категорія"
        options={parentOptions}
        value={form.parentId ?? ROOT_PARENT_VALUE}
        onChange={(value) => setForm((f) => ({ ...f, parentId: value === ROOT_PARENT_VALUE ? null : value }))}
      />
      <Input
        label="Порядок сортування"
        type="number"
        value={form.sortOrder}
        onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
      />
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
        Активна
      </label>
      <div className="flex justify-between gap-2">
        {modalMode === 'edit' && (
          <Button type="button" variant="danger" onClick={handleDeleteCategory} isLoading={isSaving}>
            Видалити
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
            Скасувати
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Зберегти
          </Button>
        </div>
      </div>
    </>
  );

  const attributesPanel = (
    <div className="flex flex-col gap-4">
      {attributes.length === 0 ? (
        <p className="text-sm text-gray-500">Атрибутів ще немає.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attributes.map((attr) => {
            const edit = attrEdits[attr.id] ?? { labelUk: attr.labelUk, isRequired: attr.isRequired, isFilterable: attr.isFilterable };
            return (
              <li key={attr.id} className="rounded-xl border border-gray-200 p-2">
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-mono">{attr.key}</span>
                  <Badge tone="neutral">{DATA_TYPE_OPTIONS.find((o) => o.value === attr.dataType)?.label ?? attr.dataType}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={edit.labelUk}
                    onChange={(e) =>
                      setAttrEdits((prev) => ({ ...prev, [attr.id]: { ...edit, labelUk: e.target.value } }))
                    }
                    className="h-9 flex-1 rounded-xl border border-gray-300 px-2 text-sm"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={edit.isRequired}
                      onChange={(e) =>
                        setAttrEdits((prev) => ({ ...prev, [attr.id]: { ...edit, isRequired: e.target.checked } }))
                      }
                    />
                    Обов&apos;язковий
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={edit.isFilterable}
                      onChange={(e) =>
                        setAttrEdits((prev) => ({ ...prev, [attr.id]: { ...edit, isFilterable: e.target.checked } }))
                      }
                    />
                    Фільтр
                  </label>
                  <Button size="sm" variant="secondary" isLoading={savingAttrId === attr.id} onClick={() => handleSaveAttribute(attr.id)}>
                    Зберегти
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAddAttribute} className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        <p className="text-sm font-medium text-gray-700">+ Атрибут</p>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="key (напр. brand)"
            value={newAttr.key}
            onChange={(e) => setNewAttr((a) => ({ ...a, key: e.target.value }))}
            className="h-9 flex-1 rounded-xl border border-gray-300 px-2 text-sm"
          />
          <input
            placeholder="Назва (укр.)"
            value={newAttr.labelUk}
            onChange={(e) => setNewAttr((a) => ({ ...a, labelUk: e.target.value }))}
            className="h-9 flex-1 rounded-xl border border-gray-300 px-2 text-sm"
          />
        </div>
        <div className="w-56">
          <Dropdown
            label="Тип даних"
            options={DATA_TYPE_OPTIONS}
            value={newAttr.dataType}
            onChange={(value) => setNewAttr((a) => ({ ...a, dataType: value as AttributeDataType }))}
          />
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={newAttr.isRequired}
              onChange={(e) => setNewAttr((a) => ({ ...a, isRequired: e.target.checked }))}
            />
            Обов&apos;язковий
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={newAttr.isFilterable}
              onChange={(e) => setNewAttr((a) => ({ ...a, isFilterable: e.target.checked }))}
            />
            Фільтр
          </label>
        </div>
        <Button type="submit" size="sm" isLoading={isAddingAttr}>
          Додати атрибут
        </Button>
      </form>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Категорії</h1>
        <Button onClick={() => openCreate(null)}>+ Категорія</Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження категорій…" />
      ) : (
        <ul className="rounded-2xl border border-gray-200 bg-white">
          {tree.map((node) => (
            <CategoryNode key={node.id} node={node} depth={0} onEdit={openEdit} onAddChild={openCreate} />
          ))}
        </ul>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'Нова категорія' : `Редагувати: ${editingCategory?.nameUk ?? ''}`}
      >
        {modalMode === 'edit' ? (
          <Tabs
            items={[
              { id: 'category', label: 'Категорія', content: <Form onSubmit={handleSaveCategory}>{categoryFields}</Form> },
              { id: 'attributes', label: 'Атрибути', content: attributesPanel },
            ]}
          />
        ) : (
          <Form onSubmit={handleSaveCategory}>{categoryFields}</Form>
        )}
      </Modal>
    </div>
  );
}
