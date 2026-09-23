package everything.fits.snug.bag.puzzle;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Tràn viền: bối cảnh chạy xuống dưới cả thanh trạng thái lẫn thanh điều hướng.
 *
 * Có hai nửa việc, thiếu nửa nào cũng hỏng:
 *
 *  1. Cho cửa sổ vẽ tràn ra sau hai thanh hệ thống (setDecorFitsSystemWindows(false)),
 *     và làm hai thanh ấy trong suốt (khai trong styles.xml).
 *
 *  2. Đẩy số đo hai thanh đó vào CSS. Đây mới là chỗ dễ hụt: trên Android,
 *     env(safe-area-inset-*) CHỈ trả về phần khuyết của màn (tai thỏ), còn thanh trạng
 *     thái và thanh điều hướng thì luôn là 0 — tin vào nó là nút tạm dừng nằm ngay dưới
 *     đồng hồ hệ thống mà không ai hay. Nên đọc insets từ phía Android rồi ghi thẳng
 *     vào hai biến CSS cho trang tự chừa lề.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Tràn viền TRƯỚC khi cửa sổ dựng khung đầu tiên. Đặt sau super.onCreate thì WebView đã
    // kịp vẽ một khung chừa thanh điều hướng, rồi mới giãn xuống dưới thanh đó: cả trang giật
    // xuống một nhịp ngay lúc mở app.
    // Phải đổi sang theme chơi (không thanh tiêu đề) trước đã: chạm vào cửa sổ lúc còn theme
    // khởi động là cửa sổ dựng luôn bằng theme đó, và thanh tiêu đề "Everything Fits" hiện ra.
    setTheme(R.style.AppTheme_NoActionBar);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    super.onCreate(savedInstanceState);

    // Nền của game là mảng tường kem và mặt bàn gỗ sáng, nên chữ và icon của hai thanh
    // hệ thống phải là màu tối mới đọc được.
    View decor = getWindow().getDecorView();
    WindowInsetsControllerCompat bar = WindowCompat.getInsetsController(getWindow(), decor);
    bar.setAppearanceLightStatusBars(true);
    bar.setAppearanceLightNavigationBars(true);

    final WebView web = getBridge().getWebView();
    final float d = getResources().getDisplayMetrics().density;

    ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
      Insets bars = insets.getInsets(
          WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      // Chia cho density: Android đo bằng pixel thật, CSS đo bằng pixel logic.
      final String js = String.format(
          java.util.Locale.US,
          "document.documentElement.style.setProperty('--sat','%.2fpx');"
              + "document.documentElement.style.setProperty('--sab','%.2fpx');"
              + "document.documentElement.style.setProperty('--sal','%.2fpx');"
              + "document.documentElement.style.setProperty('--sar','%.2fpx');",
          bars.top / d, bars.bottom / d, bars.left / d, bars.right / d);
      web.post(() -> web.evaluateJavascript(js, null));
      return insets;   // trả nguyên vẹn: WebView không tự chừa lề, trang lo phần đó
    });

    ViewCompat.requestApplyInsets(web);
  }
}
