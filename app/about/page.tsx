import '../(site)/chariot.css'
import '../(site)/about.page.css'
import { ABOUT_HTML } from '../(site)/_markup/about'
import SiteScripts from '../(site)/SiteScripts'

export const metadata = {
  title: 'Chariot — About',
  description: 'Accra. Austin. What the rest of the world is already wearing.',
}

export default function AboutPage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: ABOUT_HTML }} />
      <SiteScripts />
    </>
  )
}
