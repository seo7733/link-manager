# 즐순이 (Link Manager)

React + Vite 기반 즐겨찾기/링크 매니저. Supabase 백엔드 사용.

📖 **사용자 매뉴얼**: [사용자_매뉴얼.md](./사용자_매뉴얼.md)

## 링크 순서 기능 (sort_order)

링크 순서를 변경하려면 Supabase에 `sort_order` 컬럼이 필요합니다.  
Supabase 대시보드 → **SQL Editor**에서 아래 마이그레이션을 실행하세요:

```
supabase/migrations/20250208000000_add_links_sort_order.sql
```

또는 해당 파일 내용을 복사해 SQL Editor에 붙여 넣고 실행하면 됩니다.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
