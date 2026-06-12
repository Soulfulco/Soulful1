import { Router, type IRouter } from "express";
import healthRouter from "./health";
import practitionersRouter from "./practitioners";
import companiesRouter from "./companies";
import availabilityRouter from "./availability";
import bookingsRouter from "./bookings";
import subscriptionsRouter from "./subscriptions";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";
import locationsRouter from "./locations";
import { employeesRouter, companyEmployeesRouter } from "./employees";
import groupSessionsRouter from "./groupSessions";
import socialCalendarRouter from "./socialCalendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(practitionersRouter);
router.use(companiesRouter);
router.use(companyEmployeesRouter);
router.use(availabilityRouter);
router.use(bookingsRouter);
router.use(subscriptionsRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);
router.use(locationsRouter);
router.use(employeesRouter);
router.use(groupSessionsRouter);
router.use(socialCalendarRouter);

export default router;
