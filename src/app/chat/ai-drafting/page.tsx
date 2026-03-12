import * as Layouts from "@/refresh-components/layouts/layouts";
import { fetchHeaderDataSS } from "@/lib/headers/fetchHeaderDataSS";
import GenerateAgreementPage from "../ai-drafting/generate-agreement/GenerateAgreementPage";

export default async function Page() {
  const headerData = await fetchHeaderDataSS();

  return (
    <Layouts.AppPage {...headerData}>
     <GenerateAgreementPage />
    </Layouts.AppPage>
  );
}