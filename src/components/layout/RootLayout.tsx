import { Outlet } from 'react-router-dom'

import AppNavbar from './AppNavbar'

const RootLayout = () => {
  return (
    <>
      <AppNavbar />
      <main className="pt-24">
        <Outlet />
      </main>
    </>
  )
}

export default RootLayout
