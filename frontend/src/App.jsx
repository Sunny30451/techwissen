import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import AdminPortal from './components/AdminPortal.jsx';
import HomePage from './pages/HomePage.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import { stripAppBaseUrl } from './config.js';

export default function App() {
  const relativePath = stripAppBaseUrl(window.location.pathname);
  const path = relativePath.replace(/\/+$/, '') || '/';
  const articleMatch = path.match(/^\/artikel\/([^/]+)$/);

  if (path === '/admin') return <AdminPortal section="editorial" />;
  if (path === '/admin/system') return <AdminPortal section="system" />;

  return (
    <>
      <Header />
      {articleMatch ? <ArticlePage slug={decodeURIComponent(articleMatch[1])} /> : <HomePage />}
      <Footer />
    </>
  );
}
