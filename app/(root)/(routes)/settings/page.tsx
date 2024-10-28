import { SubscriptionButton } from "@/components/SubscriptionButton";
import { checkSubscription } from "@/lib/subscription";

const SettingPage = async () => {
  const isPro = await checkSubscription();

  // Define features for each plan
  const features = {
    Free: [
      "Unlimited API requests",
      "50,000 monthly active users",
      "500 MB database space",
      "5 GB bandwidth",
      "1 GB file storage",
      "Community support",
    ],
    Pro: [
      "Everything in the Free Plan, plus:",
      "100,000 monthly active users",
      "3 GB disk size per project",
      "250 GB bandwidth",
      "100 GB file storage",
      "Email support",
      "Daily backups stored for 7 days",
    ],
  };

  return (
    <div className="h-full p-4 ">
      <h3 className="text-lg font-medium">Settings</h3>
      <div className="text-muted-foreground text-sm mb-4">
        {isPro
          ? <span>You are currently on a <span className="text-[18px] font-semibold text-blue-500 mx-1"> Pro </span> plan</span>
          : <span>You are currently on a <span className="text-[18px] font-semibold text-blue-500 mx-1"> FREE </span> plan</span>}
      </div>
      <h4 className="text-md font-semibold mt-4 mb-1">Features:</h4>
      <table className="min-w-full border-collapse border border-gray-800 mb-6">
        <thead>
          <tr className="bg-gray-800">
            <th className="border border-gray-300 p-2">Feature</th>
            <th className="border border-gray-300 p-2">Free Plan</th>
            <th className="border border-gray-300 p-2">Pro Plan</th>
          </tr>
        </thead>
        <tbody>
          {features.Free.map((feature, index) => (
            <tr key={index}>
              <td className="border border-gray-300 p-2">{feature}</td>
              <td className="border border-gray-300 p-2 text-center">✔️</td>
              <td className="border border-gray-300 p-2 text-center">
                {isPro ? "✔️" : "❌"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SubscriptionButton isPro={isPro} />
    </div>
  );
};

export default SettingPage;
