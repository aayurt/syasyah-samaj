import { isJsonEqual, withEquality } from "./equality.mjs";
import { createSessionRefreshManager } from "./session-refresh.mjs";
import { atom, onMount } from "nanostores";
//#region src/client/session-atom.ts
const isServer = () => typeof window === "undefined";
/**
* Normalize $fetch response: `throw: true` returns data directly,
* otherwise `{ data, error }`.
*/
function normalizeSessionResponse(res) {
	if (typeof res === "object" && res !== null && "data" in res && "error" in res) return res;
	return {
		data: res,
		error: null
	};
}
function normalizeSessionData(data) {
	if (!data) return null;
	if (data.session === null && data.user === null) return null;
	return data;
}
function isSessionAtomEqual(a, b) {
	return isJsonEqual(a.data, b.data) && a.error === b.error && a.isPending === b.isPending && a.isRefetching === b.isRefetching && a.refetch === b.refetch;
}
function getSessionAtom($fetch, options) {
	const $signal = atom(false);
	let activeRequest;
	const refetch = (queryParams) => fetchSession(queryParams);
	const session = atom({
		data: null,
		error: null,
		isPending: true,
		isRefetching: false,
		refetch
	});
	withEquality(session, isSessionAtomEqual);
	const executeSessionFetch = async (signal, queryParams) => {
		const current = session.value;
		session.set({
			...current,
			isPending: current.data === null,
			isRefetching: true,
			error: null,
			refetch
		});
		if (signal.aborted) return;
		try {
			const res = await $fetch("/get-session", {
				method: "GET",
				query: queryParams?.query,
				signal
			});
			if (signal.aborted) return;
			let { data, error } = normalizeSessionResponse(res);
			if (data?.needsRefresh) try {
				const refreshRes = await $fetch("/get-session", {
					method: "POST",
					signal
				});
				if (signal.aborted) return;
				({data, error} = normalizeSessionResponse(refreshRes));
			} catch {
				if (signal.aborted) return;
			}
			if (error) {
				const latest = session.value;
				const isUnauthorized = error?.status === 401;
				session.set({
					data: isUnauthorized ? null : latest.data,
					error,
					isPending: false,
					isRefetching: false,
					refetch
				});
				return;
			}
			const sessionData = normalizeSessionData(data);
			const current = session.value;
			const stableData = current.data != null && sessionData != null && isJsonEqual(current.data, sessionData) ? current.data : sessionData;
			session.set({
				data: stableData,
				error: null,
				isPending: false,
				isRefetching: false,
				refetch
			});
		} catch (fetchError) {
			if (signal.aborted) return;
			const latest = session.value;
			session.set({
				data: latest.data,
				error: fetchError,
				isPending: false,
				isRefetching: false,
				refetch
			});
		}
	};
	const fetchSession = (queryParams) => {
		activeRequest?.cancel();
		const controller = new AbortController();
		const request = {
			cancel: () => controller.abort(),
			promise: Promise.resolve().then(() => {
				if (controller.signal.aborted) return;
				return executeSessionFetch(controller.signal, queryParams);
			})
		};
		activeRequest = request;
		const clearActiveRequest = () => {
			if (activeRequest === request) activeRequest = void 0;
		};
		request.promise.then(clearActiveRequest, clearActiveRequest);
		return request.promise;
	};
	const fetchSessionOnMount = () => activeRequest?.promise ?? fetchSession();
	let broadcastSessionUpdate = () => {};
	onMount(session, () => {
		let timeoutId;
		if (!isServer()) timeoutId = setTimeout(() => {
			fetchSessionOnMount();
		}, 0);
		const refreshManager = createSessionRefreshManager({
			fetchSession,
			shouldPollSession: () => session.value.data != null,
			sessionSignal: $signal,
			options
		});
		refreshManager.init();
		broadcastSessionUpdate = refreshManager.broadcastSessionUpdate;
		return () => {
			if (timeoutId) clearTimeout(timeoutId);
			refreshManager.cleanup();
		};
	});
	return {
		session,
		$sessionSignal: $signal,
		broadcastSessionUpdate: (trigger) => broadcastSessionUpdate(trigger)
	};
}
//#endregion
export { getSessionAtom };
