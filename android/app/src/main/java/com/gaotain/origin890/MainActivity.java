package com.gaotain.origin890;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.net.Uri;
import android.graphics.Color;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private WebView viewer;
    private static final String HOST = "appassets.androidplatform.net";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16,21,30));
        getWindow().setNavigationBarColor(Color.rgb(16,21,30));
        viewer = new WebView(this);
        viewer.setBackgroundColor(Color.rgb(16,21,30));
        WebSettings settings = viewer.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        viewer.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost()) || !"https".equals(uri.getScheme())) return missing();
                String path = uri.getPath();
                if (path == null || path.contains("..") || path.contains("\\")) return missing();
                if (path.startsWith("/")) path = path.substring(1);
                if (path.isEmpty()) path = "index.html";
                String mime = path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".glb") ? "model/gltf-binary" : path.endsWith(".json") ? "application/json" : path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "text/html";
                try {
                    return new WebResourceResponse(mime, mime.startsWith("image/") || path.endsWith(".glb") ? null : "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control","no-cache"), getAssets().open(path));
                } catch (IOException e) { return missing(); }
            }
        });
        setContentView(viewer);
        viewer.loadUrl("https://" + HOST + "/index.html");
    }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    @Override protected void onPause() { viewer.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (viewer != null) viewer.onResume(); }
    @Override protected void onDestroy() { viewer.destroy(); super.onDestroy(); }
}
