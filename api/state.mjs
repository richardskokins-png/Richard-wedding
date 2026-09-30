import { calculateSummary } from "../business.mjs";
import { publicEmployee, publicRecord } from "./_lib/public-data.mjs";
import { handleError, method, roleIdFrom, send } from "./_lib/http.mjs";
import { getEmployee, listAllRecords, listExpenses, listSales } from "./_lib/repository.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const employee = await getEmployee(roleIdFrom(req));
    if (!employee) return send(res, 403, { error: "Choose a valid demonstration role.", code: "FORBIDDEN" });
    if (employee.role === "manager") {
      const { sales, expenses } = await listAllRecords();
      return send(res, 200, { mode: "live", employee: publicEmployee(employee), sales: sales.map(publicRecord), expenses: expenses.map(publicRecord), summary: calculateSummary(sales, expenses) });
    }
    const [sales, expenses] = await Promise.all([listSales(employee), listExpenses(employee)]);
    send(res, 200, { mode: "live", employee: publicEmployee(employee), sales: sales.map(publicRecord), expenses: expenses.map(publicRecord), summary: null });
  } catch (error) {
    handleError(res, error);
  }
}
