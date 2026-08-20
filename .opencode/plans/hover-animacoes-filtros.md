# Plano: destaque no hover dos filtros + animações de popup

Escopo aprovado: itens 1–3 (hover + animações + no-ops nos mesmos arquivos), animações via plugin inline (zero dependências novas).

## Contexto / diagnóstico

- `@base-ui/react` aplica `data-highlighted` no item sob o mouse, mas os estilos usam só `focus:` -> sem destaque.
- Projeto roda Tailwind v3.4, mas os componentes vieram de template v4. Classes que NÃO geram CSS no v3 (verificado compilando):
  - `data-open:`, `data-closed:`, `data-placeholder:`, `data-inset:`, `data-disabled:`, `data-popup-open:` (variantes nomeadas) -> usar forma `data-[x]:`.
  - `focus:**:`, `not-data-[variant=destructive]:`, `*:[span]:` (sintaxe v4).
  - `max-h-(--var)`, `w-(--var)`, `origin-(--var)` (shorthand v4) -> `max-h-[var(--x)]`.
  - `animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*-2` (utils do tw-animate-css, não importado e incompatível com v3).

## Arquivos a alterar

### 1) `tailwind.config.js`
Adicionar no topo: `import plugin from 'tailwindcss/plugin';`
Em `plugins`, registrar plugin inline que:
- `addBase` com keyframes `enter`/`exit` (usando vars `--tw-enter-*`/`--tw-exit-*`).
- `addUtilities` com: `.animate-in`, `.animate-out`, `.fade-in-0`, `.fade-out-0`, `.zoom-in-95`, `.zoom-out-95`, `.slide-in-from-top-2`, `.slide-in-from-bottom-2`, `.slide-in-from-left-2`, `.slide-in-from-right-2`.

### 2) `src/components/ui/select.tsx`
- `SelectTrigger` (linha 44): `data-placeholder:text-muted-foreground` -> `data-[placeholder]:text-muted-foreground`.
- `SelectContent` (linha 86):
  - `max-h-(--available-height)` -> `max-h-[var(--available-height)]`; `w-(--anchor-width)` -> `w-[var(--anchor-width)]`; `origin-(--transform-origin)` -> `origin-[var(--transform-origin)]`.
  - `data-open:` -> `data-[open]:`; `data-closed:` -> `data-[closed]:`.
- `SelectItem` (linha 120):
  - Adicionar `data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground`.
  - `data-inset:pl-7` -> `data-[inset]:pl-7`; `data-disabled:*` -> `data-[disabled]:*`.
  - Remover `not-data-[variant=destructive]:focus:**:text-accent-foreground` (v4-only; ícones herdam currentColor).

### 3) `src/components/ui/dropdown-menu.tsx`
- `DropdownMenuContent` (linha 42): mesmos ajustes de `max-h/w/origin` e `data-open/data-closed`.
- `DropdownMenuItem` (linha 89):
  - Adicionar `data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground`.
  - Destrutivo hover: `data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:text-destructive` (+ variante `dark:`).
  - `data-inset:`/`data-disabled:` -> forma `data-[...]:`.
  - Remover `not-data-[variant=destructive]:focus:**:text-accent-foreground` e `data-[variant=destructive]:*:[svg]:text-destructive` (v4-only/redundantes).
- `DropdownMenuLabel` (linha 66): `data-inset:pl-7` -> `data-[inset]:pl-7`.
- `DropdownMenuSubTrigger` (linha 114): `data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground`; `data-inset:pl-7` -> `data-[inset]:pl-7`; `data-popup-open:`/`data-open:` -> `data-[popup-open]:`/`data-[open]:`; remover `not-data-[variant=destructive]:focus:**:...`.
- `DropdownMenuCheckboxItem` (linha 160) e `DropdownMenuRadioItem` (linha 202): `data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground`; `data-inset:`/`data-disabled:` -> forma `data-[...]:`; remover `focus:**:text-accent-foreground`.
- `DropdownMenuSubContent` (linha 136): `data-open:`/`data-closed:` -> `data-[open]:`/`data-[closed]:`.

### 4) `src/components/ui/dialog.tsx`
- `DialogOverlay` (linha 34) e `DialogContent` (linha 56): `data-open:`/`data-closed:` -> `data-[open]:`/`data-[closed]:`.

## Verificação
- `npx tsc -b` e `npx eslint src/components/ui/select.tsx src/components/ui/dropdown-menu.tsx src/components/ui/dialog.tsx`.
- Compilar Tailwind e confirmar que `.data-\[highlighted\]\:bg-accent`, `data-[open]:animate-in`, `max-h-[var(--available-height)]`, `animate-in` etc. aparecem no CSS.
