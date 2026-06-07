import '../(site)/chariot.css'
import '../(site)/support.page.css'
import { SUPPORT_HTML } from '../(site)/_markup/support'
import SiteScripts from '../(site)/SiteScripts'

export const metadata = {
  title: 'Chariot — Support',
  description: 'Questions about Drop 0, your founding spot, store credit, and shipping.',
}

export default function SupportPage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: SUPPORT_HTML }} />
      <SiteScripts />
    </>
  )
}
